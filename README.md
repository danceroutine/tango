- [Tango](#tango)
  - [Prerequisites](#prerequisites)
  - [Getting Started](#getting-started)
    - [1. Clone the Repository](#1-clone-the-repository)
    - [2. Setup Node Version](#2-setup-node-version)
    - [3. Install Dependencies](#3-install-dependencies)
  - [Development](#development)
    - [Available Scripts](#available-scripts)
      - [Linting \& Formatting](#linting-formatting)
      - [Testing](#testing)
      - [Type Checking](#type-checking)
      - [Building](#building)
      - [Documentation](#documentation)
  - [Monorepo Structure](#monorepo-structure)
  - [Creating Packages](#creating-packages)
    - [Package Template Structure](#package-template-structure)
  - [Releasing](#releasing)
    - [Creating a Changeset](#creating-a-changeset)
    - [Stable Releases](#stable-releases)
    - [Alpha Releases](#alpha-releases)
  - [Code Quality Standards](#code-quality-standards)
  - [Contributing](#contributing)
  - [License](#license)
  - [Author](#author)

# Tango

Tango is a modern TypeScript web framework that brings the elegance and productivity of Django's design philosophy to the Node.js ecosystem. It encourages rapid development and clean, pragmatic design while leveraging TypeScript's powerful type system for maximum safety and developer experience.

Inspired by [Django](https://github.com/django/django) and Django REST Framework, Tango provides a batteries-included approach to building robust web applications and APIs with TypeScript. Thanks for checking it out.

All documentation is in the "`docs`" directory and online at the VitePress documentation site. If you're just getting started, here's how we recommend you read the docs:

- First, read the [Getting Started guide](docs/guide/getting-started.md) to understand Tango's philosophy
- Next, follow the [Installation guide](docs/guide/installation.md) for setup instructions
- Work through tutorials as they become available
- Check out the [API Reference](docs/api/) for detailed package documentation

Docs are updated regularly. If you find any problems in the docs, or think they should be clarified in any way, please open an issue or submit a pull request.

To get more help:

- Open an issue on GitHub
- Check the [documentation site](docs/)

To contribute to Tango:

- See the [Contributing](#contributing) section below for information about getting involved

To run Tango's test suite:

- Follow the instructions in the [Development](#development) section

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: >= 22.0.0 (use `nvm` to manage Node versions)
- **pnpm**: >= 9.0.0

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/danceroutine/tango.git
cd tango
```

### 2. Setup Node Version

This project uses Node.js 22. If you have `nvm` installed:

```bash
nvm use
```

This will automatically switch to Node.js 22 based on the `.nvmrc` file.

### 3. Install Dependencies

```bash
pnpm install
```

## Development

### Available Scripts

#### Linting & Formatting

```bash
pnpm lint          # Run Oxlint, ESLint, and format check
pnpm lint:ox       # Run Oxlint only
pnpm lint:eslint   # Run ESLint only
pnpm format        # Format all files with Prettier
pnpm format:check  # Check formatting without modifying files
```

#### Testing

```bash
pnpm test         # Run all tests with coverage (100% required)
pnpm test:watch   # Run tests in watch mode
```

#### Type Checking

```bash
pnpm typecheck    # Type check all packages
```

#### Building

```bash
pnpm build        # Build all packages
```

#### Documentation

```bash
pnpm docs:dev     # Start VitePress dev server
pnpm docs:build   # Build documentation site
pnpm docs:preview # Preview built documentation
```

## Monorepo Structure

```
tango/
├── packages/          # Framework packages
│   └── adapters/     # Adapter packages
├── examples/         # Example applications
├── docs/            # VitePress documentation site
└── .changeset/      # Changesets for versioning
```

## Creating Packages

All packages should:

1. Extend `tsconfig.base.json` for consistent TypeScript configuration
2. Use `tsdown` for building (ESM-only, no CommonJS)
3. Maintain 100% test coverage
4. Follow the monorepo conventions

### Package Template Structure

```
packages/my-package/
├── src/
│   ├── index.ts
│   └── *.test.ts
├── package.json
├── tsconfig.json      # Extends ../../tsconfig.base.json
├── tsdown.config.ts
└── vitest.config.ts
```

## Releasing

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

### Creating a Changeset

When you make changes that should be released:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select which packages have changed
2. Choose the semver bump type (major, minor, patch)
3. Write a summary of the changes

### Stable Releases

Stable releases are automated via GitHub Actions:

1. Push changes to `main` branch (including changeset files)
2. GitHub Actions creates a "Version Packages" PR
3. Review and merge the PR
4. GitHub Actions automatically publishes to npm

### Alpha Releases

For testing pre-release versions:

1. Go to the GitHub Actions tab
2. Select "Release Alpha" workflow
3. Click "Run workflow"
4. Specify the branch to release from
5. Packages will be published with `@alpha` tag

## Code Quality Standards

- **Linting**: Oxlint runs first (fast), then ESLint (thorough)
- **Formatting**: Prettier with automatic formatting on lint
- **Type Safety**: Strict TypeScript with `verbatimModuleSyntax`
- **Testing**: 100% code coverage required for all packages
- **Build**: ESM-only, no CommonJS support

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass (`pnpm lint && pnpm test && pnpm typecheck`)
4. Create a changeset if needed (`pnpm changeset`)
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details

## Author

Pedro Del Moral Lopez
