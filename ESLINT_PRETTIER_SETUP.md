# ESLint and Prettier Configuration Guide

This document explains how to set up and use ESLint and Prettier in the beSafeChat project.

## Overview

The project uses a monorepo structure with both frontend (React/Vite) and backend (NestJS) applications. ESLint and Prettier are configured to provide consistent code formatting and linting across both applications.

## Configuration Structure

### Root Level Configuration
- `.prettierrc` - Shared Prettier configuration for the entire project
- `eslint.config.js` - Shared ESLint configuration
- `package.json` - Contains root-level dependencies and workspace scripts

### Frontend Configuration
- `frontend/.prettierrc` - Frontend-specific Prettier settings (extends root)
- `frontend/eslint.config.js` - Frontend-specific ESLint configuration
- `frontend/package.json` - Frontend-specific linting and formatting scripts

### Backend Configuration
- `backend/.prettierrc` - Backend-specific Prettier settings (extends root)
- `backend/eslint.config.cjs` - Backend-specific ESLint configuration (existing)
- `backend/package.json` - Backend-specific linting and formatting scripts

## Installation

To install all dependencies for the project:

```bash
npm install
# or if using pnpm
cd backend && pnpm install
cd ../frontend && pnpm install
```

## Available Scripts

### Root Level
- `npm run lint` - Lint all workspaces
- `npm run lint:fix` - Fix linting issues across all workspaces
- `npm run format` - Format all files in the project
- `npm run format:check` - Check formatting across all files

### Frontend
- `npm run lint` - Lint frontend files
- `npm run lint:fix` - Fix frontend linting issues
- `npm run format` - Format frontend files
- `npm run format:check` - Check frontend formatting

### Backend
- `npm run lint` - Lint backend files with auto-fix
- `npm run lint:check` - Check backend linting issues
- `npm run format` - Format backend files
- `npm run format:check` - Check backend formatting

## VS Code Integration

The project includes recommended VS Code settings and extensions:

### Settings
- Format on save enabled
- ESLint integration for automatic fixes
- Prettier as default formatter
- Consistent tab size and spacing

### Recommended Extensions
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript
- Auto Rename Tag
- Path Intellisense

## Prettier Configuration

The shared Prettier configuration includes:
- Semi-colons: `true`
- Trailing commas: `es5`
- Single quotes: `true`
- Print width: `100`
- Tab width: `2`
- Use tabs: `false`
- Bracket spacing: `true`
- Arrow parens: `avoid`

## ESLint Configuration

### Backend (NestJS)
- TypeScript recommended rules
- Node.js globals
- Project-specific TypeScript checking

### Frontend (React)
- React Hooks rules
- React Refresh rules
- JSX accessibility rules (jsx-a11y)
- TypeScript recommended rules
- Browser globals

## Usage Tips

1. **Pre-commit hooks**: Consider setting up pre-commit hooks to run linting and formatting automatically
2. **IDE Integration**: Make sure your IDE is configured to use the project's ESLint and Prettier configurations
3. **Manual Formatting**: Use `npm run format` to format all files in the project
4. **Manual Linting**: Use `npm run lint:fix` to automatically fix linting issues

## Troubleshooting

### ESLint Issues
If you encounter ESLint errors that you believe are incorrect:
1. Check if the rule can be configured in the ESLint configuration
2. Use `// eslint-disable-next-line rule-name` for specific lines if necessary
3. Discuss with the team if a rule should be modified globally

### Prettier Issues
If Prettier formatting conflicts with your code:
1. Check the `.prettierrc` configuration
2. Use `// prettier-ignore` for specific lines if absolutely necessary
3. Consider if the formatting improves readability before overriding

## Adding New Rules

To add new ESLint rules:
1. Update the appropriate ESLint configuration file
2. Test the new rules on the codebase
3. Update this documentation if necessary
4. Communicate changes to the team

## Updating Dependencies

ESLint and Prettier dependencies should be updated regularly:
1. Update the root package.json dependencies
2. Test the configuration after updates
3. Update this documentation if breaking changes occur