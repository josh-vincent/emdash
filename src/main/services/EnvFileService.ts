import { log } from '../lib/logger';
import path from 'path';
import fs from 'fs';

export interface EnvFileConfig {
  strategy: 'symlink' | 'copy' | 'hybrid';
  patterns: string[];
  sharedEnvName: string;
}

export class EnvFileService {
  /**
   * Setup environment files in a new worktree based on the configured strategy
   */
  async setupEnvFiles(
    projectPath: string,
    worktreePath: string,
    config: EnvFileConfig
  ): Promise<void> {
    try {
      log.info(`Setting up env files in worktree with strategy: ${config.strategy}`);

      switch (config.strategy) {
        case 'symlink':
          await this.symlinkStrategy(projectPath, worktreePath, config);
          break;
        case 'copy':
          await this.copyStrategy(projectPath, worktreePath, config);
          break;
        case 'hybrid':
          await this.hybridStrategy(projectPath, worktreePath, config);
          break;
        default:
          log.warn(`Unknown env file strategy: ${config.strategy}, skipping`);
      }

      log.info('Env files setup completed successfully');
    } catch (error) {
      log.error('Failed to setup env files:', error);
      // Don't throw - env file setup failure shouldn't block worktree creation
    }
  }

  /**
   * Strategy 1: Symlink - Create symlinks to all env files in main repo
   */
  private async symlinkStrategy(
    projectPath: string,
    worktreePath: string,
    config: EnvFileConfig
  ): Promise<void> {
    const envFiles = await this.findEnvFiles(projectPath, config.patterns);

    for (const envFile of envFiles) {
      const relativePath = path.relative(projectPath, envFile);
      const targetPath = path.join(worktreePath, relativePath);
      const targetDir = path.dirname(targetPath);

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Skip if symlink already exists and points to correct location
      if (fs.existsSync(targetPath)) {
        try {
          const stats = fs.lstatSync(targetPath);
          if (stats.isSymbolicLink()) {
            const linkTarget = fs.readlinkSync(targetPath);
            if (path.resolve(targetDir, linkTarget) === envFile) {
              log.debug(`Symlink already exists: ${targetPath}`);
              continue;
            }
          }
          // Remove existing file/symlink if it's incorrect
          fs.unlinkSync(targetPath);
        } catch (err) {
          log.warn(`Error checking existing file ${targetPath}:`, err);
        }
      }

      // Create symlink
      try {
        const relativeSource = path.relative(targetDir, envFile);
        fs.symlinkSync(relativeSource, targetPath);
        log.info(`Created symlink: ${targetPath} -> ${envFile}`);
      } catch (err) {
        log.error(`Failed to create symlink ${targetPath}:`, err);
      }
    }
  }

  /**
   * Strategy 2: Copy - Copy all env files to worktree
   */
  private async copyStrategy(
    projectPath: string,
    worktreePath: string,
    config: EnvFileConfig
  ): Promise<void> {
    const envFiles = await this.findEnvFiles(projectPath, config.patterns);

    for (const envFile of envFiles) {
      const relativePath = path.relative(projectPath, envFile);
      const targetPath = path.join(worktreePath, relativePath);
      const targetDir = path.dirname(targetPath);

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy file
      try {
        fs.copyFileSync(envFile, targetPath);
        log.info(`Copied env file: ${envFile} -> ${targetPath}`);
      } catch (err) {
        log.error(`Failed to copy env file ${envFile}:`, err);
      }
    }
  }

  /**
   * Strategy 3: Hybrid - Symlink shared env, support local overrides
   *
   * Structure created:
   * - Main repo has .env.shared (or configured name)
   * - Worktree gets symlink to shared file
   * - Worktree can have .env.local for overrides
   */
  private async hybridStrategy(
    projectPath: string,
    worktreePath: string,
    config: EnvFileConfig
  ): Promise<void> {
    const sharedEnvPath = path.join(projectPath, config.sharedEnvName);

    // Create .env.shared in main repo if it doesn't exist
    if (!fs.existsSync(sharedEnvPath)) {
      // Look for existing .env file to migrate
      const existingEnv = path.join(projectPath, '.env');
      if (fs.existsSync(existingEnv)) {
        try {
          fs.copyFileSync(existingEnv, sharedEnvPath);
          log.info(`Created ${config.sharedEnvName} from existing .env`);
        } catch (err) {
          log.warn(`Failed to copy existing .env to ${config.sharedEnvName}:`, err);
        }
      } else {
        // Create empty shared env file
        try {
          fs.writeFileSync(
            sharedEnvPath,
            '# Shared environment variables for all worktrees\n' +
              '# Override in .env.local for worktree-specific values\n',
            'utf8'
          );
          log.info(`Created empty ${config.sharedEnvName}`);
        } catch (err) {
          log.warn(`Failed to create ${config.sharedEnvName}:`, err);
        }
      }
    }

    // Create symlink to shared env in worktree
    if (fs.existsSync(sharedEnvPath)) {
      const symlinkPath = path.join(worktreePath, '.env');
      const targetDir = path.dirname(symlinkPath);

      // Remove existing .env if it exists and is not a symlink to shared
      if (fs.existsSync(symlinkPath)) {
        try {
          const stats = fs.lstatSync(symlinkPath);
          if (stats.isSymbolicLink()) {
            const linkTarget = fs.readlinkSync(symlinkPath);
            if (path.resolve(targetDir, linkTarget) === sharedEnvPath) {
              log.debug('Shared env symlink already exists');
              return;
            }
          }
          fs.unlinkSync(symlinkPath);
        } catch (err) {
          log.warn(`Error checking existing .env:`, err);
        }
      }

      // Create symlink
      try {
        const relativeSource = path.relative(worktreePath, sharedEnvPath);
        fs.symlinkSync(relativeSource, symlinkPath);
        log.info(`Created symlink: ${symlinkPath} -> ${sharedEnvPath}`);
      } catch (err) {
        log.error(`Failed to create shared env symlink:`, err);
      }

      // Create .env.local.example if it doesn't exist
      const envLocalExample = path.join(worktreePath, '.env.local.example');
      if (!fs.existsSync(envLocalExample)) {
        try {
          fs.writeFileSync(
            envLocalExample,
            '# Worktree-specific environment variables\n' +
              '# Copy this to .env.local and customize for this worktree\n' +
              '# These values will override those in .env.shared\n',
            'utf8'
          );
          log.info('Created .env.local.example in worktree');
        } catch (err) {
          log.warn('Failed to create .env.local.example:', err);
        }
      }
    }
  }

  /**
   * Find all env files in a directory matching the given patterns
   */
  private async findEnvFiles(basePath: string, patterns: string[]): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of patterns) {
      try {
        // Simple pattern matching for .env* files
        const matches = this.findFilesByPattern(basePath, pattern);
        files.push(...matches);
      } catch (err) {
        log.warn(`Failed to find files matching pattern ${pattern}:`, err);
      }
    }

    // Deduplicate
    return Array.from(new Set(files));
  }

  /**
   * Recursively find files matching a pattern (simplified glob implementation)
   */
  private findFilesByPattern(dir: string, pattern: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules, dist, release, and .git directories
        if (
          entry.isDirectory() &&
          ['node_modules', 'dist', 'release', '.git', 'worktrees'].includes(entry.name)
        ) {
          continue;
        }

        if (entry.isFile()) {
          // Simple pattern matching for .env* files
          if (pattern === '.env*' && entry.name.startsWith('.env')) {
            files.push(fullPath);
          } else if (entry.name === pattern) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      log.debug(`Error reading directory ${dir}:`, err);
    }

    return files;
  }

  /**
   * Update .gitignore to ensure env files are properly ignored
   */
  ensureEnvIgnored(worktreePath: string, config: EnvFileConfig): void {
    try {
      const gitignorePath = path.join(worktreePath, '.gitignore');
      let gitignoreContent = '';

      // Read existing .gitignore
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      }

      // Patterns to ensure are in .gitignore
      const patternsToIgnore = [
        '.env',
        '.env.local',
        '.env.*.local',
        config.sharedEnvName,
      ];

      let modified = false;
      const lines = gitignoreContent.split('\n');

      for (const pattern of patternsToIgnore) {
        // Check if pattern already exists
        const exists = lines.some(
          (line) => line.trim() === pattern || line.trim() === `/${pattern}`
        );

        if (!exists) {
          lines.push(pattern);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(gitignorePath, lines.join('\n'), 'utf8');
        log.info('Updated .gitignore with env file patterns');
      }
    } catch (err) {
      log.warn('Failed to update .gitignore:', err);
      // Non-critical error, don't throw
    }
  }
}

export const envFileService = new EnvFileService();
