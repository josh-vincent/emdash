# Quick Start: Environment File Management

This guide gets you started with env file management in 5 minutes.

## TL;DR

When you create worktrees in emdash, environment files are automatically shared with per-worktree overrides:

- **Shared**: `.env.shared` in main repo (used by all worktrees)
- **Override**: `.env.local` in each worktree (optional, worktree-specific)

## Step-by-Step Setup

### 1. Create Shared Environment File

In your main repository:

```bash
cd /Users/mini/Claude/github/emdash  # Your main repo path

# Create shared env file (or it will be auto-created)
cat > .env.shared << 'EOF'
# Shared environment variables
DATABASE_URL=postgresql://localhost:5432/myapp_dev
API_BASE_URL=http://localhost:3000
API_KEY=dev_key_12345
NODE_ENV=development
EOF
```

### 2. Create a Worktree

Use emdash UI to create a new worktree normally. The env files are set up automatically!

### 3. Verify Setup

Check the new worktree:

```bash
cd /path/to/your/worktree

# Check symlink was created
ls -la .env
# Should show: .env -> ../../emdash/.env.shared

# View shared variables
cat .env
# Shows content from .env.shared

# Check example file was created
cat .env.local.example
```

### 4. Add Worktree-Specific Overrides (Optional)

If you need different values in this worktree:

```bash
# Create local overrides
cat > .env.local << 'EOF'
# Override port to avoid conflicts
API_BASE_URL=http://localhost:3001
EOF

# Now this worktree uses port 3001, others use 3000
```

## Common Scenarios

### Scenario 1: Running Multiple Features Simultaneously

Each feature needs a different port:

**Worktree A (.env.local):**
```bash
API_BASE_URL=http://localhost:3001
```

**Worktree B (.env.local):**
```bash
API_BASE_URL=http://localhost:3002
```

**Worktree C (.env.local):**
```bash
API_BASE_URL=http://localhost:3003
```

All share other variables from `.env.shared`.

### Scenario 2: Testing with Different Databases

One worktree needs a separate database:

**Worktree Experimental (.env.local):**
```bash
DATABASE_URL=postgresql://localhost:5432/myapp_experimental
```

Others use the shared database.

### Scenario 3: Production Hotfix

One worktree needs production credentials:

**Worktree Hotfix (.env.local):**
```bash
API_KEY=prod_key_xyz
NODE_ENV=production
DATABASE_URL=postgresql://prod-server:5432/myapp_prod
```

## Changing Strategy

If you want a different approach:

### Switch to Copy Strategy

Edit `~/Library/Application Support/emdash/settings.json`:

```json
{
  "repository": {
    "envFiles": {
      "strategy": "copy"
    }
  }
}
```

Now new worktrees get independent copies instead of symlinks.

### Switch to Symlink Strategy

```json
{
  "repository": {
    "envFiles": {
      "strategy": "symlink"
    }
  }
}
```

Now all env files are symlinked (no per-worktree overrides).

## Troubleshooting

### "Environment variables not loading"

1. Check if symlink exists:
   ```bash
   ls -la .env
   ```

2. Verify it points to the right file:
   ```bash
   readlink .env
   # Should show: ../../emdash/.env.shared
   ```

3. Check the shared file exists:
   ```bash
   cat $(readlink .env)
   ```

### "I want to manually create the setup"

If you have an existing worktree without env setup:

```bash
cd /path/to/worktree

# Create symlink manually
ln -s ../../emdash/.env.shared .env

# Create local override file
touch .env.local
```

### "Symlinks don't work on Windows"

Change strategy to `copy` in settings (see above).

## Best Practices

1. **Never commit secrets**
   - Keep `.env.shared` and `.env.local` in `.gitignore`
   - Only commit `.env.example`

2. **Document required variables**
   - Update `.env.example` when adding new variables
   - Add comments explaining each variable

3. **Use consistent naming**
   - Shared values: `.env.shared`
   - Local overrides: `.env.local`
   - Templates: `.env.example`

4. **Rotate exposed secrets**
   - If you accidentally commit a secret, rotate it immediately
   - Use `git rm --cached .env` to remove from git

## Next Steps

- Read full documentation: `docs/ENV_FILE_MANAGEMENT.md`
- Learn about the three strategies in detail
- Explore advanced configuration options

## Quick Reference

| File | Location | Purpose | Git Tracked? |
|------|----------|---------|--------------|
| `.env.shared` | Main repo | Shared variables | No |
| `.env` | Worktree | Symlink to shared | No |
| `.env.local` | Worktree | Overrides | No |
| `.env.example` | Main repo | Template | Yes |
| `.env.local.example` | Worktree | Override template | Yes |

## Help

Issues? Check:
- Full docs: `docs/ENV_FILE_MANAGEMENT.md`
- emdash GitHub: https://github.com/generalaction/emdash
- Discord: https://discord.gg/f2fv7YxuR2
