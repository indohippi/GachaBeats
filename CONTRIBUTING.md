# Contributing to GachaBeats

Thank you for your interest in contributing to GachaBeats! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate
- Welcome newcomers and help them get started
- Be open to constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling or insulting/derogatory comments
- Public or private harassment
- Publishing others' private information without permission
- Other conduct that would be inappropriate in a professional setting

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Git
- A code editor (VS Code recommended)

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/gachabeats.git
   cd gachabeats
   ```

3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/original-owner/gachabeats.git
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Set up your environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

6. Set up the database:
   ```bash
   npm run db:push
   ```

7. Install git hooks:
   ```bash
   npm run prepare
   ```

## Development Workflow

### Creating a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks

### Making Changes

1. Make your changes in your feature branch
2. Write or update tests for your changes
3. Ensure all tests pass: `npm test`
4. Run linting: `npm run lint:fix`
5. Check types: `npm run check`

### Keeping Your Branch Updated

Regularly sync with the upstream repository:

```bash
git fetch upstream
git rebase upstream/main
```

## Coding Standards

### TypeScript

- **Never use `any` type** - Use proper typing or `unknown` with type guards
- Use explicit return types for functions
- Enable strict mode in tsconfig.json
- Prefer interfaces over types for object shapes

Example:
```typescript
// Good
interface User {
  id: number;
  username: string;
}

function getUser(id: number): Promise<User | null> {
  // implementation
}

// Bad
function getUser(id: any): any {
  // implementation
}
```

### React Components

- Use functional components with hooks
- Keep components under 300 lines
- Use proper prop typing
- Implement error boundaries for critical sections
- Use `useCallback` and `useMemo` appropriately

Example:
```typescript
interface ButtonProps {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}

export default function Button({ onClick, label, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### Naming Conventions

- **Components**: PascalCase (`GachaCapture.tsx`)
- **Files**: PascalCase for components, camelCase for utilities
- **Functions**: camelCase (`getUserData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces/Types**: PascalCase (`UserProfile`)

### File Organization

```typescript
// Imports order:
// 1. React/external libraries
// 2. Internal components
// 3. Utilities/helpers
// 4. Types
// 5. Styles

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import type { User } from "@/types";
```

### Error Handling

Always handle errors gracefully:

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof SpecificError) {
    logger.error('Specific error occurred', error);
    throw new CustomError('User-friendly message');
  }
  logger.error('Unexpected error', error);
  throw error;
}
```

### Security Best Practices

- Validate all user inputs with Zod schemas
- Never log sensitive information (passwords, tokens)
- Use parameterized queries (Drizzle handles this)
- Set secure HTTP headers
- Implement rate limiting on sensitive endpoints

## Testing Guidelines

### Writing Tests

- Write tests for all new features
- Test both success and error cases
- Mock external dependencies
- Keep tests focused and isolated

Example test:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Button from "./Button";

describe("Button", () => {
  it("renders with label", () => {
    render(<Button onClick={vi.fn()} label="Click me" />);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const { user } = render(<Button onClick={onClick} label="Click" />);
    await user.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button onClick={vi.fn()} label="Click" disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

### Test Coverage

- Aim for 60%+ code coverage
- Focus on business logic and critical paths
- UI components should have basic rendering tests
- API endpoints should have integration tests

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass
2. Run linting and fix any issues
3. Update documentation if needed
4. Add/update tests for your changes
5. Ensure your branch is up to date with main

### Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Go to the repository on GitHub and create a pull request

3. Fill out the pull request template completely:
   - Clear description of changes
   - Link related issues
   - List what was changed
   - Describe testing performed
   - Add screenshots if applicable

4. Wait for CI checks to complete

5. Request review from maintainers

### Pull Request Requirements

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with main
- [ ] No merge conflicts
- [ ] CI checks pass

### Review Process

- Maintainers will review your PR within 2-3 business days
- Address any requested changes
- Once approved, a maintainer will merge your PR
- Delete your feature branch after merging

## Commit Message Guidelines

### Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```bash
feat(gacha): add legendary rarity tier

Implement legendary rarity with 0.5% drop rate.
Includes special animation and sound effects.

Closes #123

---

fix(auth): prevent session fixation vulnerability

Update session regeneration on login to prevent
session fixation attacks.

---

docs(readme): update installation instructions

Add PostgreSQL setup steps and troubleshooting guide.
```

### Rules

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to" not "moves cursor to")
- Keep subject line under 50 characters
- Wrap body at 72 characters
- Reference issues and PRs in footer

## Questions or Issues?

- Check existing issues before creating a new one
- Use issue templates when reporting bugs or requesting features
- Join our discussions for questions and ideas
- Tag maintainers if you need help

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for their contributions
- GitHub contributor graphs

Thank you for contributing to GachaBeats! 🎮🎵
