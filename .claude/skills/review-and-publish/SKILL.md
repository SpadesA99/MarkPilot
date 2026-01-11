---
name: review-and-publish
description: "Review code, update README, commit, push, and publish a new tag. Triggers: /publish, /release, review code + publish"
---

# Review and Publish Skill

Automated workflow for code review, version bump, and release publishing.

## Trigger Keywords

This skill is triggered by:
- `/publish` - Run the full workflow
- `/release` - Run the full workflow
- User mentions "review code" followed by requests to commit/push/publish

## Workflow Steps

### Step 1: Code Review

Scan recently modified files for common issues:

```bash
git status
git diff --name-only HEAD~1
```

**Check for:**
- Unused imports
- Hardcoded values that should be dynamic
- Missing error handling (try-catch for URL parsing, API calls)
- CSS/Tailwind issues (group-hover without group class, truncate without min-w-0)
- Console.log statements that should be removed

**Fix any issues found before proceeding.**

### Step 2: Build Verification

Ensure the project builds successfully:

```bash
npm run build
```

If build fails, fix errors before proceeding.

### Step 3: Version Bump

Read current version from package.json and increment:
- **Patch (x.x.X)**: Bug fixes, minor improvements
- **Minor (x.X.0)**: New features
- **Major (X.0.0)**: Breaking changes

```bash
# Check current version
cat package.json | grep '"version"'
```

Update package.json with new version.

### Step 4: Commit and Push

```bash
git add -A
git commit -m "$(cat <<'EOF'
<type>: <description>

- <change 1>
- <change 2>
EOF
)"
git push
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance, version bump
- `refactor`: Code restructuring
- `docs`: Documentation only

### Step 5: Create and Push Tag

```bash
git tag v<version>
git push origin v<version>
```

## Example Workflow

**User:** "review code, update README, commit push, publish tag"

**AI should:**

1. **Review code:**
   ```bash
   git status
   git diff
   ```
   - Scan for issues
   - Fix any problems found
   - Run build to verify

2. **Bump version:**
   - Read package.json
   - Increment version (e.g., 1.5.1 → 1.5.2)
   - Update package.json

3. **Commit:**
   ```bash
   git add -A
   git commit -m "fix: <summary of changes>"
   ```

4. **Push and tag:**
   ```bash
   git push
   git tag v1.5.2
   git push origin v1.5.2
   ```

5. **Report:**
   - Confirm version published
   - List changes included

## Quick Commands

```bash
# Full workflow
/publish

# Just review
/review

# Just release (skip review)
/release
```

## Output Format

After completion, report:

```
完成！v<version> 已发布。

**更新内容：**
- <change 1>
- <change 2>
- <change 3>
```
