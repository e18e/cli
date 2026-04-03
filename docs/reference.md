# Reference

[← Back to docs index](../README.md)

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
