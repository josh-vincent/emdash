# Environment File Management in Worktrees

This document explains how emdash manages environment files (`.env*`) across git worktrees.

## Overview

When working with multiple git worktrees, managing environment variables can be challenging. You typically want:
- Shared configuration across all worktrees
- Ability to override values per worktree
- No accidental commits of sensitive data
- Automatic setup when creating new worktrees

Emdash provides three strategies for managing environment files across worktrees.

## Configuration

Environment file management is configured in your app settings. You can modify these settings in the emdash UI or by editing the settings file directly.

### Settings Location

Settings are stored at: `~/Library/Application Support/emdash/settings.json` (macOS)

### Configuration Options

```json
{
  "repository": {
    "envFiles": {
      "strategy": "hybrid",           // "symlink" | "copy" | "hybrid"
      "patterns": [".env*"],          // File patterns to manage
      "sharedEnvName": ".env.shared"  // Name of shared env file
    }
  }
}
```

## Strategies

### 1. Symlink Strategy

**Best for:** Simple projects where all worktrees use identical environment variables.

**How it works:**
- Creates symlinks from worktree to main repo's env files
- All worktrees point to the same files
- Changes in one location affect all worktrees

**Structure:**
```
main-repo/
├── .env                    # Original env file
└── .env.local

worktrees/
└── my-worktree/
    ├── .env -> ../../main-repo/.env           # Symlink
    └── .env.local -> ../../main-repo/.env.local
```

**Pros:**
- Single source of truth
- Changes instantly available everywhere
- No duplication

**Cons:**
- Can't have different values per worktree
- Symlinks may not work well on some Windows setups

### 2. Copy Strategy

**Best for:** Independent worktrees that need different configurations.

**How it works:**
- Copies all env files to each worktree
- Each worktree has independent copies
- Changes don't propagate automatically

**Structure:**
```
main-repo/
├── .env
└── .env.local

worktrees/
└── my-worktree/
    ├── .env           # Independent copy
    └── .env.local     # Independent copy
```

**Pros:**
- Complete independence between worktrees
- No symlink issues on Windows
- Each worktree can have different values

**Cons:**
- Files can get out of sync
- Manual updates needed for shared changes
- More disk space used

### 3. Hybrid Strategy (Recommended)

**Best for:** Most projects - combines shared defaults with worktree-specific overrides.

**How it works:**
- Main repo contains `.env.shared` with common variables
- Each worktree gets a symlink to `.env.shared` as `.env`
- Worktrees can have `.env.local` for overrides
- Follows standard env file precedence (`.env.local` > `.env`)

**Structure:**
```
main-repo/
├── .env.shared          # Shared env vars (gitignored)
└── .env.example         # Example/template (committed)

worktrees/
└── my-worktree/
    ├── .env -> ../../main-repo/.env.shared    # Symlink to shared
    ├── .env.local                             # Worktree-specific overrides
    └── .env.local.example                     # Example for overrides
```

**Pros:**
- Shared defaults with local overrides
- Clear separation of concerns
- Works with standard .env loading libraries
- Most flexible approach

**Cons:**
- Slightly more complex structure
- Requires understanding of env file precedence

## How It Works

### Automatic Setup

When you create a new worktree using emdash, the environment files are automatically configured based on your chosen strategy.

### For Hybrid Strategy (default):

1. **On first worktree creation:**
   - If `.env` exists in main repo, it's copied to `.env.shared`
   - Otherwise, an empty `.env.shared` is created with helpful comments

2. **For each new worktree:**
   - Symlink created: `worktree/.env` → `main-repo/.env.shared`
   - Example file created: `worktree/.env.local.example`
   - You can create `worktree/.env.local` with overrides

### Environment Variable Precedence

Most .env libraries (like `dotenv`) load files in this order (later overrides earlier):

1. `.env` (shared via symlink)
2. `.env.local` (worktree-specific)

This means you can:
- Put common values in `.env.shared` (via main repo)
- Override specific values in `.env.local` (per worktree)

## Usage Examples

### Example 1: Database Connection

**`.env.shared` (main repo):**
```bash
# Shared database for all worktrees
DATABASE_URL=postgresql://localhost:5432/myapp_dev
API_BASE_URL=http://localhost:3000
NODE_ENV=development
```

**`worktree-feature-a/.env.local`:**
```bash
# Override port for this worktree to avoid conflicts
API_BASE_URL=http://localhost:3001
```

**`worktree-feature-b/.env.local`:**
```bash
# Different database for testing major schema changes
DATABASE_URL=postgresql://localhost:5432/myapp_experimental
```

### Example 2: API Keys

**`.env.shared` (main repo):**
```bash
# Shared development keys
STRIPE_PUBLIC_KEY=pk_test_xxx
SENDGRID_API_KEY=SG.xxx
```

**`worktree-production-hotfix/.env.local`:**
```bash
# Use production keys for this worktree
STRIPE_PUBLIC_KEY=pk_live_xxx
SENDGRID_API_KEY=SG.live_xxx
```

## Best Practices

### 1. Always Gitignore Sensitive Files

Ensure your `.gitignore` includes:
```
.env
.env.local
.env.*.local
.env.shared
```

Keep only `.env.example` and `.env.local.example` in version control.

### 2. Use .env.example Files

**`.env.example` (committed to git):**
```bash
# Example environment variables
# Copy to .env.shared and fill in real values

DATABASE_URL=postgresql://localhost:5432/myapp
API_KEY=your_api_key_here
```

### 3. Document Required Variables

Add comments to your `.env.example`:
```bash
# Database connection string
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://localhost:5432/myapp

# Stripe API keys (get from https://dashboard.stripe.com)
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
```

### 4. Don't Commit Secrets

Never commit actual API keys, passwords, or secrets to git. Use:
- `.env.shared` for real values (gitignored)
- `.env.example` for templates (committed)

### 5. Validate Environment Variables

Use environment variable validation in your app:
```typescript
// Example using zod
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']),
});

export const env = envSchema.parse(process.env);
```

## Switching Strategies

You can change your strategy at any time by updating the settings:

```json
{
  "repository": {
    "envFiles": {
      "strategy": "copy"  // Changed from "hybrid"
    }
  }
}
```

**Note:** Changing strategy only affects newly created worktrees. Existing worktrees keep their current setup.

## Troubleshooting

### Symlinks Not Working (Windows)

If you're on Windows and symlinks aren't working:

1. Enable Developer Mode in Windows Settings
2. Or switch to `"strategy": "copy"` in settings
3. Restart emdash after changing strategy

### Environment Variables Not Loading

1. Check symlink points to correct file:
   ```bash
   ls -la .env
   ```

2. Verify file exists:
   ```bash
   cat .env
   ```

3. Check your .env library is configured correctly:
   ```typescript
   // Example with dotenv
   import { config } from 'dotenv';

   config(); // Loads .env
   config({ path: '.env.local' }); // Then loads .env.local
   ```

### Different Values in Different Worktrees

This is expected with hybrid strategy! Use `.env.local` for overrides:

```bash
# In any worktree
echo "API_URL=http://localhost:3001" >> .env.local
```

### Accidentally Committed .env File

1. Remove from git but keep local file:
   ```bash
   git rm --cached .env
   git commit -m "Remove .env from git"
   ```

2. Ensure `.gitignore` includes `.env`

3. If sensitive data was exposed, rotate your secrets immediately

## Advanced Configuration

### Custom Patterns

You can specify which files to manage:

```json
{
  "repository": {
    "envFiles": {
      "strategy": "hybrid",
      "patterns": [".env*", ".env.local*", "config/.env*"]
    }
  }
}
```

### Custom Shared File Name

Change the name of the shared env file:

```json
{
  "repository": {
    "envFiles": {
      "sharedEnvName": ".env.development"
    }
  }
}
```

## FAQ

### Q: Can I use different strategies for different projects?

A: Yes, settings are global but you can manually manage env files differently per project if needed.

### Q: What happens to existing worktrees when I change strategy?

A: Nothing - strategy changes only affect newly created worktrees.

### Q: Can I disable env file management?

A: Yes, simply remove the `envFiles` configuration from settings, or set strategy to an empty string.

### Q: How do I share .env.shared across team members?

A: **Don't!** Each team member should have their own `.env.shared` with their local values. Share `.env.example` instead via git.

### Q: Can I manually run the env setup on an existing worktree?

A: Currently no, but you can manually create symlinks using standard shell commands if needed.

## Related

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [The Twelve-Factor App - Config](https://12factor.net/config)
- [dotenv Documentation](https://github.com/motdotla/dotenv)
