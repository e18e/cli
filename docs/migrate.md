# Command: `migrate`

[← Back to docs index](../README.md)

Runs codemods from the [`module-replacements-codemods`](https://www.npmjs.com/package/module-replacements-codemods) package on files in your project to rewrite imports/usages for packages you choose. Only packages that are both **listed in your dependencies** and **have a bundled codemod** are eligible.

## Examples

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

## Working directory

The command uses the **current working directory**. It requires a `package.json` there.

## Arguments and flags

- **Positionals** — After `migrate`, supply one or more **package names** to migrate (e.g. `migrate chalk lodash.merge`), unless you use `--interactive` or `--all`.
- `--interactive` — Prompt to multi-select from eligible packages (respects `--categories`).
- `--all` — Migrate every eligible package that appears in your dependencies.
- `--dry-run` — Show what would run; **do not** write changed files.
- `--include <glob>` — Files to touch (default: `**/*.{ts,js}`). `node_modules` is ignored.
- `--categories` — Same values as `analyze` (`all`, `native`, `preferred`, `micro-utilities`, or comma-separated).

## Scope: what `migrate` does and does not do

- **Does:** Read matching source files, run codemods, and **write** updated source back (unless `--dry-run`).
- **Does not:** Automatically update `package.json`, `package-lock.json`, or other lockfiles. After migrating, update dependency versions and reinstall with your package manager as needed.
