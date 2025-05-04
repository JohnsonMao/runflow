# Git Commit Message Guidelines

> This document provides standardized guidelines for writing git commit messages. Following these conventions ensures consistency and clarity in project history, making it easier to understand changes, generate changelogs, and collaborate effectively.

## Format Specification

```
<type>(<scope>): <short description>

[detailed description]
```

## Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect code execution (whitespace, formatting, missing semicolons, etc.)
- `refactor`: Code refactoring (without bug fixes or feature additions)
- `perf`: Performance improvements
- `test`: Test-related changes
- `chore`: Changes to build process or auxiliary tools

## Rules

1. Title line should not exceed 50 characters
2. Description should be concise and in English
3. Type and scope must be lowercase
4. Do not add a period at the end of the title line
5. Use imperative mood in the title line (e.g., "fix" not "fixed" or "fixes")
6. Add detailed description only when the title cannot convey sufficient information

## Scope Description

The scope should be the main component of the application, for example:
- `auth`: Authentication related
- `api`: API related
- `ui`: User interface related
- `db`: Database related
- `config`: Configuration related

## Examples

```
feat(auth): implement JWT authentication

- Add token generation and validation
- Create middleware for protected routes
- Implement refresh token mechanism
```

```
fix(api): resolve user data fetch error

Fix status code handling in user API response
```

```
refactor(ui): optimize component rendering
```

```
chore(deps): update package dependencies
```
