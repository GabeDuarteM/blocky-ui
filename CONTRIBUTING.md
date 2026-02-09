# Contributing to BlockyUI

Thanks for your interest in contributing to BlockyUI! This guide walks you through the process of setting up the project and submitting changes.

Please note that this project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [pnpm](https://pnpm.io/) (v10+) — the project enforces pnpm via `packageManager` in `package.json`
- [Docker](https://www.docker.com/) or [Podman](https://podman.io/) — required for running integration tests (testcontainers)

## Development Setup

1. Fork and clone the repository:

```bash
git clone https://github.com/<your-username>/blocky-ui.git
cd blocky-ui
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with appropriate values for your setup. You can set `DEMO_MODE=true` to use mocked data without a running Blocky instance.

4. Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

## Making Changes

1. Create a branch from `main`:

```bash
git checkout -b my-change
```

2. Make your changes.

3. Run the full check suite before pushing:

```bash
pnpm run ci
```

This runs linting, formatting checks, and type checking in one command.

4. If your changes affect the query log providers (`src/server/logs/`), also run the integration tests:

```bash
pnpm run test
```

Integration tests use testcontainers and require Docker or Podman to be running.

## Adding a Changeset

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. When your PR introduces user-facing changes (bug fixes, new features, etc.), you can include a changeset with

```bash
pnpm changeset
```

This will prompt you to:

1. Select the change type:
   - **patch** for bug fixes
   - **minor** for new features with non-breaking changes
   - **major** for any change containing breaking changes
2. Write a short summary of what was changed. This will be included as a release changelog.

A new markdown file will be created in the `.changeset/` directory, commit it along with your changes.

You can skip the changeset for changes that don't affect the published package (documentation updates, CI changes, refactors with no behavior change, etc.).

## Submitting a Pull Request

1. Push your branch to your fork:

```bash
git push origin my-change
```

2. Open a pull request against `main` on [GabeDuarteM/blocky-ui](https://github.com/GabeDuarteM/blocky-ui).

3. CI will automatically run:
   - **CI job** — linting, formatting, and type checking (`pnpm run ci`)
   - **Integration tests** — Vitest with testcontainers (`pnpm run test`)

   Both checks must pass before your PR can be merged.

## Reporting Bugs and Requesting Features

- **Bugs**: Open an issue with steps to reproduce, expected behavior, and actual behavior.
- **Feature requests**: Open an issue describing the use case and the proposed solution.

If you're unsure whether something is a bug or want to discuss an idea before opening an issue, feel free to start a [discussion](https://github.com/GabeDuarteM/blocky-ui/discussions).
