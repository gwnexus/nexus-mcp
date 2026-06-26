# Contributing to Nexus MCP

Thank you for your interest in contributing to the Nexus MCP server.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/nexus-mcp.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/my-feature`

## Requirements

- Node.js >= 20
- TypeScript >= 5.8

## Development Workflow

```bash
# Install dependencies
npm install

# Type-check
npm run typecheck

# Run tests
npm test

# Build
npm run build

# Run in development mode
npm run dev
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include tests for new functionality
- Ensure `npm run typecheck` and `npm test` pass
- Write clear commit messages following [Conventional Commits](https://www.conventionalcommits.org/)

## Adding a New MCP Tool

1. Create a new file in `src/tools/` following the existing pattern
2. Export the tool schema (Zod) and handler function
3. Register the tool in `src/server.ts`
4. Add tests in `src/__tests__/`

## Reporting Bugs

Open an issue on GitHub with:
- Node.js version (`node --version`)
- Package version (`npx @gwdn/nexus-mcp --version`)
- Steps to reproduce
- Expected vs. actual behavior

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
