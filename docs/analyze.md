# Command: `analyze`

[← Back to docs index](../README.md)

Analyzes a package using several built-in checks (publint, replacement suggestions, dependency summary, duplicate versions in the lockfile).

## Prerequisites

- A `package.json` at the project root.
- A supported lockfile next to it: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, or `bun.lock`.

Analysis reads the lockfile and `package.json` together. If no lockfile is found, the CLI errors instead of guessing.

## Examples

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

## Optional positional argument

- **`[directory]`** — Root of the package to analyze. If omitted, the current working directory is used. Must be a directory (not a file).

## Flags

| Flag | Description |
|------|-------------|
| `--log-level <level>` | `debug`, `info`, `warn`, or `error` (default: `info`). Sets minimum log verbosity **and** the minimum message severity that causes a **non-zero exit** (see [Exit codes](#exit-codes-analyze)). |
| `--categories <list>` | Replacement manifest scope: `all`, or comma-separated `native`, `preferred`, `micro-utilities` (e.g. `native,preferred`). Invalid values exit with code `1`. |
| `--manifest <path>` | Extra replacement manifest file(s); can be passed multiple times. |
| `--json` | Print `{ stats, messages }` as JSON on stdout and skip the interactive UI. Exit code still follows `--log-level` vs message severities. |

## What the summary metrics mean

Here’s what each value in the summary represents:

- **Dependencies (production / development)** — Counts of **direct** dependencies only: keys in `dependencies` and `devDependencies` in `package.json`. This is **not** the number of transitive packages in your install graph.
- **Install size** — Sum of **file sizes under `node_modules`** for the current install (on-disk footprint). It is **not** a separate “dependency tree node count.”
- **Duplicate dependency** messages — Packages that appear with **more than one resolved version** in the parsed lockfile, with context about dependents. That reflects lock/install reality, not the direct-dependency counts above.

## What analysis includes

Checks are implemented as plugins wired in `report()` (see `src/analyze/report.ts`), including:

- **Publint** — Package publishing best practices.
- **Replacements** — Suggested swaps from the module-replacements manifests (scoped by `--categories` and optional `--manifest`).
- **Dependency summary** — Direct dependency counts and install size (as described above).
- **Duplicate dependencies** — Multiple versions of the same package name in the lockfile.

## Exit codes (`analyze`)

Message severities are `error`, `warning`, and `suggestion`. With **`--json`**, results are always printed; the process exits with **`1`** if any message meets or exceeds the severity implied by `--log-level`:

| `--log-level` | Fails (exit `1`) when |
|---------------|------------------------|
| `debug` | Never (for exit purposes; still lists all messages) |
| `info` | Any `error`, `warning`, or `suggestion` |
| `warn` | `error` or `warning` |
| `error` | `error` only |

Invalid `--categories` or an invalid analyze path also yields exit code `1`.

## Running with `npx`

Some package runners mishandle flags or the `--` separator when invoking a package binary (for example `npx @e18e/cli -- --help` may not do what you expect). If help or subcommand flags behave oddly, run **`e18e-cli`** after a global install, or invoke **`npx @e18e/cli`** with no extra flags and use the [**Usage**](../README.md#usage) examples on the repository README.
