# @e18e/cli

![hero](./public/banner.png)

The **e18e CLI** analyzes JavaScript and TypeScript projects for packaging issues, dependency health, and opportunities to switch to lighter or native alternatives.

> [!IMPORTANT]
> This project is still in early development and we are actively working on it. If you encounter any issues or have ideas for new features, please let us know by [opening an issue](https://github.com/e18e/cli/issues/new/choose) on our GitHub repository.

## Installation

```sh
npm install -g @e18e/cli
```

## Usage

```sh
npx @e18e/cli analyze
npx @e18e/cli analyze /path/to/project
npx @e18e/cli analyze --json
npx @e18e/cli migrate chalk
npx @e18e/cli migrate --interactive
```

Command-line options, exit behavior, and fuller examples are in the docs below.

## Documentation

| Page | Description |
|------|-------------|
| [`analyze`](./docs/analyze.md) | Analyze command: examples, flags, metrics, exit codes, what checks run |
| [`migrate`](./docs/migrate.md) | Migrate command: examples, flags, scope |
| [Programmatic API](./docs/programmatic-api.md) | Experimental `report()` usage and trust exports (`src/index.ts`) |

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
