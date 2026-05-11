# Command: `analyze`

[← Back to docs index](../README.md)

Analyzes a package using several built-in checks:

- **Publint**: package publishing best practices.
- **Replacements**: community suggested replacements for your dependencies
- **Syntax replacements**: scans your source files for code patterns that can be rewritten using newer, built-in web features (via `@e18e/web-features-codemods`).
- **core-js**: flags broad `core-js` imports and individual polyfills that are unnecessary for your declared Node.js engine range.
- **Dependency summary**: summary of dependency stats such as install size, direct-dependency counts, and more.
- **Duplicate dependencies**: detect dependencies that are included multiple times in the dependency tree, which can lead to larger bundle sizes and potential version conflicts.

## Prerequisites

- A `package.json` at the project root.
- A supported lockfile next to it: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, or `bun.lock`.

Analysis reads the lockfile and `package.json` together. If no lockfile is found, the CLI errors instead of guessing.

## Usage

```sh
npx @e18e/cli analyze [directory]
```

With a global install, swap `npx @e18e/cli` for `e18e-cli` (same arguments).

### Positional argument

- **`[directory]`**: root of the package to analyze. If omitted, the current working directory is used. Must be a directory (not a file).

### Flags

#### `--log-level <level>`

One of `debug`, `info`, `warn`, or `error` (default: `info`). Sets the minimum message severity that causes a non-zero exit. Also enables debug logging when set to `debug`.

#### `--quiet`

ESLint-style quiet mode. Only `error` messages appear in results and JSON `messages`. Overrides `--report-level`.

#### `--report-level <level>`

One of `auto`, `debug`, `info`, `warn`, or `error` (default: `auto`). Controls which severities are shown in results and JSON `messages`. `auto` means "follow `--log-level`".

#### `--categories <list>`

Replacement manifest scope: `all`, or a comma-separated list of `native`, `preferred`, `micro-utilities` (e.g. `native,preferred`). Invalid values exit with code `1`.

These categories decide which community list to use when suggesting replacements of dependencies. For example, `native` only suggests replacements that are native to the runtime (e.g. Node built-ins and browser APIs), while `preferred` is an opinionated list of alternatives the community prefers.

#### `--manifest <path>`

Extra replacement manifest file(s). Can be passed multiple times.

These are JSON files with the same format as the built-in replacement manifests. You can read more about the format in the [module-replacements](https://github.com/e18e/module-replacements) repository.

#### `--json`

Print `{ stats, messages }` as JSON on stdout and skip the interactive UI. `messages` follow `--quiet` or the resolved `--report-level`. Exit code still follows `--log-level` vs message severities.

## Running with `npx`

Some package runners mishandle flags or the `--` separator when invoking a package binary (for example `npx @e18e/cli -- --help` may not do what you expect). If help or subcommand flags behave oddly, run **`e18e-cli`** after a global install, or invoke **`npx @e18e/cli`** with no extra flags and use the [**Usage**](../README.md#usage) examples on the repository README.
