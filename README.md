# @e18e/cli

![hero](./public/banner.png)

The **e18e CLI** analyzes JavaScript and TypeScript projects for packaging issues, dependency health, and opportunities to switch to lighter or native alternatives. It runs [publint](https://github.com/publint/publint)-style checks, evaluates [module replacement](https://github.com/es-tooling/module-replacements) suggestions (including optional custom manifests), inspects the lockfile for duplicate package versions, and can apply codemods to migrate specific dependencies in your source files.

> [!IMPORTANT]
> This project is still in early development. If you hit problems or want a feature, please [open an issue](https://github.com/e18e/cli/issues/new/choose).

## Documentation

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

Run `npx @e18e/cli` with no subcommand to print global usage, or use **`e18e-cli <command> -h`** after a global install. All flags are documented in the sections below.

## Command: `analyze`

Analyzes a package using several built-in checks (publint, replacement suggestions, dependency summary, duplicate versions in the lockfile).

### Examples

```sh
# Analyze the current directory (must contain package.json + a supported lockfile)
npx @e18e/cli analyze

# Analyze a different package root
npx @e18e/cli analyze ./packages/app

# JSON on stdout for scripts and CI; exit code reflects --log-level vs findings
npx @e18e/cli analyze --json

# Fail CI only on errors, not warnings or suggestions
npx @e18e/cli analyze --json --log-level error

# Narrow replacement suggestions to the "native" manifest category
npx @e18e/cli analyze --categories native

# Combine categories
npx @e18e/cli analyze --categories native,preferred

# Extra replacement manifests (repeat --manifest for each file)
npx @e18e/cli analyze --manifest ./config/e18e.manifest.json
```

With a global install, swap `npx @e18e/cli` for `e18e-cli` (same arguments).

### Optional positional argument

- **`[directory]`** — Root of the package to analyze. If omitted, the current working directory is used. Must be a directory (not a file).

### Flags

| Flag | Description |
|------|-------------|
| `--log-level <level>` | `debug`, `info`, `warn`, or `error` (default: `info`). Sets minimum log verbosity **and** the minimum message severity that causes a **non-zero exit** (see [Exit codes](#exit-codes)). |
| `--categories <list>` | Replacement manifest scope: `all`, or comma-separated `native`, `preferred`, `micro-utilities` (e.g. `native,preferred`). Invalid values exit with code `1`. |
| `--manifest <path>` | Extra replacement manifest file(s); can be passed multiple times. |
| `--json` | Print `{ stats, messages }` as JSON on stdout and skip the interactive UI. Exit code still follows `--log-level` vs message severities. |

### What the summary metrics mean

The analyze summary is easy to misread; this is what the numbers **actually** represent:

- **Dependencies (production / development)** — Counts of **direct** dependencies only: keys in `dependencies` and `devDependencies` in `package.json`. This is **not** the number of transitive packages in your install graph.
- **Install size** — Sum of **file sizes under `node_modules`** for the current install (on-disk footprint). It is **not** a separate “dependency tree node count.”
- **Duplicate dependency** messages — Packages that appear with **more than one resolved version** in the parsed lockfile, with context about dependents. That reflects lock/install reality, not the direct-dependency counts above.

### What analysis includes

Checks are implemented as plugins wired in `report()` (see `src/analyze/report.ts`), including:

- **Publint** — Package publishing best practices.
- **Replacements** — Suggested swaps from the module-replacements manifests (scoped by `--categories` and optional `--manifest`).
- **Dependency summary** — Direct dependency counts and install size (as described above).
- **Duplicate dependencies** — Multiple versions of the same package name in the lockfile.

## Command: `migrate`

Runs codemods from the [`module-replacements-codemods`](https://www.npmjs.com/package/module-replacements-codemods) package on files in your project to rewrite imports/usages for packages you choose. Only packages that are both **listed in your dependencies** and **have a bundled codemod** are eligible.

### Examples

Run these from the project root (where `package.json` lives):

```sh
# Migrate one dependency you have installed (updates source; see Scope below)
npx @e18e/cli migrate chalk

# Several packages in one run
npx @e18e/cli migrate chalk is-odd

# Pick eligible packages from a prompt
npx @e18e/cli migrate --interactive

# Everything eligible in package.json (still respects codemod availability)
npx @e18e/cli migrate --all

# Preview changes without writing files
npx @e18e/cli migrate chalk --dry-run

# Only touch TypeScript under src/ (default is **/*.{ts,js})
npx @e18e/cli migrate chalk --include 'src/**/*.ts'

# Limit which replacement families are considered (same as analyze)
npx @e18e/cli migrate --interactive --categories native,preferred
```

With a global install, swap `npx @e18e/cli` for `e18e-cli` (same arguments).

### Working directory

The command uses the **current working directory**. It requires a `package.json` there.

### Arguments and flags

- **Positionals** — After `migrate`, supply one or more **package names** to migrate (e.g. `migrate chalk lodash.merge`), unless you use `--interactive` or `--all`.
- `--interactive` — Prompt to multi-select from eligible packages (respects `--categories`).
- `--all` — Migrate every eligible package that appears in your dependencies.
- `--dry-run` — Show what would run; **do not** write changed files.
- `--include <glob>` — Files to touch (default: `**/*.{ts,js}`). `node_modules` is ignored.
- `--categories` — Same values as `analyze` (`all`, `native`, `preferred`, `micro-utilities`, or comma-separated).

### Scope: what `migrate` does and does not do

- **Does:** Read matching source files, run codemods, and **write** updated source back (unless `--dry-run`).
- **Does not:** Automatically update `package.json`, `package-lock.json`, or other lockfiles. After migrating, update dependency versions and reinstall with your package manager as needed.

## Exit codes (`analyze`)

Message severities are `error`, `warning`, and `suggestion`. With **`--json`**, results are always printed; the process exits with **`1`** if any message meets or exceeds the severity implied by `--log-level`:

| `--log-level` | Fails (exit `1`) when |
|---------------|------------------------|
| `debug` | Never (for exit purposes; still lists all messages) |
| `info` | Any `error`, `warning`, or `suggestion` |
| `warn` | `error` or `warning` |
| `error` | `error` only |

Invalid `--categories` or an invalid analyze path also yields exit code `1`.

## Programmatic API (experimental)

The published package entry (`src/index.ts`) currently exposes **`report()`** (same implementation the `analyze` command uses) and re-exports types such as **`Message`**, **`Options`**, and **`Stat`**. **`src/core/trust.ts`** is also exported for provenance/trust helpers.

That layout is intentional for early tooling and dogfooding, but it is **not a finished or semver-stable API** yet: signatures and options may change without a major bump while the CLI is pre–1.0. For production automation, prefer **`e18e-cli analyze --json`** until maintainers document and commit to a library surface. If you import the package anyway, pin the version and expect occasional churn.

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
