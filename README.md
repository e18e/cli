# @e18e/cli

![hero](./public/banner.png)

The **e18e CLI** analyzes JavaScript and TypeScript projects for packaging issues, dependency health, and opportunities to switch to lighter or native alternatives. It runs [publint](https://github.com/publint/publint)-style checks, evaluates [module replacement](https://github.com/es-tooling/module-replacements) suggestions (including optional custom manifests), inspects the lockfile for duplicate package versions, and can apply codemods to migrate specific dependencies in your source files.

> [!IMPORTANT]
> This project is still in early development. If you hit problems or want a feature, please [open an issue](https://github.com/e18e/cli/issues/new/choose).

**This README is the canonical reference for the CLI.** The copy on [e18e.dev](https://e18e.dev/docs/cli) may be shorter or update on a different cadence; when in doubt, trust what you read here and match it to this repository.

## Prerequisites

- A `package.json` at the project root.
- A supported lockfile next to it: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, or `bun.lock`.

Analysis reads the lockfile and `package.json` together. If no lockfile is found, the CLI errors instead of guessing.

## Installation

```sh
# No global install: npx fetches the package (add --yes for a non-interactive first run)
npx @e18e/cli --help

# Global install (binary name is e18e-cli)
npm install -g @e18e/cli

# Run this to verify installation
e18e-cli -v
```

The published executable is **`e18e-cli`** (see `bin` in `package.json`). `npx @e18e/cli …` runs that binary with the arguments you pass after the package name.

If your package manager ever forwards flags to the wrong process, use the bare command above, or put **`--`** before CLI flags (for example `npx --yes @e18e/cli -- --help`).

## Quick start

```sh
# Analyze the current directory (default)
npx @e18e/cli analyze

# Analyze another project (must be a directory path)
npx @e18e/cli analyze /path/to/project

# Machine-readable output (see Exit codes)
npx @e18e/cli analyze --json

# Migrate one package you depend on (source codemods; see migrate scope)
npx @e18e/cli migrate chalk

# Pick packages interactively
npx @e18e/cli migrate --interactive
```

Run `npx @e18e/cli` with no subcommand to print global usage, or use **`e18e-cli <command> -h`** after a global install. Full flags and examples: [**analyze**](./analyze.md), [**migrate**](./migrate.md). Exit codes and API notes: [**reference**](./reference.md).

## Documentation

| Page | Description |
|------|-------------|
| [`analyze`](./docs/analyze.md) | Analyze command: examples, flags, metrics, what checks run |
| [`migrate`](./docs/migrate.md) | Migrate command: examples, flags, scope |
| [Reference](./docs/reference.md) | Exit codes (`analyze`), programmatic API (experimental) |

## Contributing

We're happy you'd like to get involved! Please join our [Discord](https://chat.e18e.dev) server to discuss with others.

## Sponsors

<p align="center">
  <a href="https://e18e.dev/sponsor">
    <img src="https://e18e.dev/sponsors.svg" alt="e18e community sponsors" />
  </a>
</p>

## License

MIT License @2025 - Present e18e contributors.
