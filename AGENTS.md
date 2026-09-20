# Blocky UI

Blocky UI is a dashboard for the Blocky DNS proxy. Use Bun for package management and scripts.

## Checks

- After code changes, run `bun run verify` and resolve failures introduced by the change.
- Run the tests relevant to changed behavior with `bun run test <path>`. This runs Vitest.

## Provider compatibility

Changes to a query log provider or shared log code must preserve compatibility across all supported providers. For every such change, run the full log test suite with `bun run test src/server/logs`, including the integration tests in `src/server/logs/__tests__/`.

The integration suite uses testcontainers with real databases and requires Docker or Podman. Verify that the change works across providers, including those you did not modify.

## Conventions

- Prefer inferred types. Use `unknown` instead of `any` when the type is unknown.
- Do not use non-null assertions (`!`) or type casting to bypass errors. Fix the types or narrow values instead.
- Use Tailwind classes for styling.
- Prefer Drizzle query builders; use raw SQL only when necessary.

## Shared UI components

Ask before editing existing components in `src/components/ui/`. When shadcn provides a component, add it with the shadcn CLI. Preserve local customizations when adding or updating components.

## Task references

- Configuration changes: read [blocky-ui.example.yml](blocky-ui.example.yml) and [src/env.js](src/env.js).
- Changesets: follow [.agents/skills/generate-changeset/SKILL.md](.agents/skills/generate-changeset/SKILL.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
