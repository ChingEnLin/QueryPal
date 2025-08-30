# Semantic Versioning with Conventional Commits

This repository uses automated semantic versioning based on conventional commits. The version numbers are automatically calculated and tagged when the `production` branch is updated.

## How it works

### Conventional Commit Format

Commits should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types and Version Impact

| Commit Type | Version Bump | Description |
|-------------|--------------|-------------|
| `feat:` | Minor (x.Y.z) | New features |
| `fix:` | Patch (x.y.Z) | Bug fixes |
| `docs:` | Patch (x.y.Z) | Documentation changes |
| `style:` | Patch (x.y.Z) | Code style changes (formatting, etc.) |
| `refactor:` | Patch (x.y.Z) | Code refactoring |
| `perf:` | Patch (x.y.Z) | Performance improvements |
| `test:` | Patch (x.y.Z) | Test additions or updates |
| `build:` | Patch (x.y.Z) | Build system changes |
| `ci:` | Patch (x.y.Z) | CI/CD changes |
| `chore:` | Patch (x.y.Z) | Maintenance tasks |
| `BREAKING CHANGE:` | Major (X.y.z) | Breaking changes (in commit body or footer) |
| `!` after type | Major (X.y.z) | Breaking changes (e.g., `feat!:` or `fix!:`) |

### Examples

```bash
# Minor version bump (2.0.0 → 2.1.0)
feat: add user authentication system

# Patch version bump (2.0.0 → 2.0.1)
fix: resolve login timeout issue

# Major version bump (2.0.0 → 3.0.0)
feat!: redesign user API with breaking changes

# Or using footer:
feat: redesign user API

BREAKING CHANGE: User API endpoints have changed
```

## Workflow Trigger

The semantic versioning workflow is triggered when:

1. **Push to production branch** - Automatic versioning and release
2. **Manual workflow dispatch** - Can be triggered manually from GitHub Actions

## What happens during a release

1. **Analyze commits** - Parse commit messages since the last tag
2. **Calculate version** - Determine next version based on commit types
3. **Create tag** - Tag the commit with the new version (e.g., `v2.1.0`)
4. **Generate changelog** - Update `CHANGELOG.md` with release notes
5. **Create GitHub release** - Create a GitHub release with generated notes
6. **Update wiki** - Update the project wiki with release information

## Version History

The project started with version `v2.0.0`. All subsequent versions follow semantic versioning:

- **Major** (X.y.z): Breaking changes
- **Minor** (x.Y.z): New features (backward compatible)
- **Patch** (x.y.Z): Bug fixes (backward compatible)

## Deployment Integration

The semantic versioning workflow integrates with the existing Google Cloud Run deployment workflow:

1. Semantic versioning runs first on `production` branch push
2. Creates version tag and release notes
3. The existing deployment workflow can reference the tagged version

## Best Practices

1. **Use descriptive commit messages** - Clear, concise descriptions help generate better release notes
2. **Follow the conventional format** - Ensures proper version bumping
3. **Include breaking change notes** - Use `BREAKING CHANGE:` in commit body for major version bumps
4. **Test before merging to production** - Only merge tested changes to the production branch
5. **Review generated changelogs** - Check the auto-generated changelog for accuracy

## Troubleshooting

### No version bump occurs
- Ensure commits follow conventional commit format
- Check that commits have occurred since the last tag
- Verify the workflow has proper permissions

### Incorrect version bump
- Review commit types in the commit messages
- Check for `BREAKING CHANGE:` or `!` indicators
- Ensure conventional commit format is followed

### Wiki update fails
- Check repository permissions for wiki access
- Verify the wiki is enabled for the repository