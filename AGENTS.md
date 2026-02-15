# Repository Guidelines

Guidelines for AI coding agents working in this repository.
Blocky UI is a Next.js dashboard for the [Blocky DNS proxy](https://github.com/0xERR0R/blocky).

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/trpc/          # tRPC API route handler
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── ui/                # shadcn/ui components (generated, do not edit)
│   └── dashboard/         # App-specific components
├── hooks/                 # Custom React hooks (use-*.ts)
├── lib/                   # Utilities (utils.ts, constants.ts)
├── mocks/                 # MSW handlers for API mocking
├── server/
│   ├── api/routers/       # tRPC routers
│   ├── logs/              # Query log providers (mysql, csv, csv-client, demo)
│   └── prometheus/        # Prometheus metrics client and parser
├── styles/globals.css     # Global styles (Tailwind v4)
├── trpc/                  # tRPC client setup
└── env.js                 # Environment validation (@t3-oss/env-nextjs)
```

## Build, Lint, and Test Commands

```bash
bun run dev                    # Start dev server (Next.js + Turbo)
bun run build                  # Production build
bun run preview                # Build and serve locally
bun run start                  # Serve an existing build
bun run lint                   # Run ESLint
bun run lint:fix               # Run ESLint with auto-fix
bun run format:check           # Check Prettier formatting
bun run format:write           # Auto-format with Prettier
bun run typecheck              # TypeScript type checking
bun run ci                     # Run all checks (lint + format + typecheck)
bun run knip                   # Detect unused exports and dependencies
bun run checkdupe              # Detect code duplication (jscpd)

# Testing (Vitest + testcontainers — requires Docker or Podman)
bun run test                            # Run all tests once
bun run test:watch                      # Run tests in watch mode
bun run test path/to/file               # Run a single test file
bun run test -t "test name"             # Run a single test by name

# Database (Drizzle)
bun run db:generate            # Generate Drizzle migrations
bun run db:migrate             # Run migrations
bun run db:push                # Push schema changes
bun run db:studio              # Open Drizzle Studio
```

After any code change, always run `bun run ci` to validate. We also have some integration tests in `src/server/logs/__tests__/` and use `testcontainers` for real database integration testing. If we change anything on those providers, please also run that to make sure we don't break anything.

## Code Style Guidelines

### TypeScript

- Strict mode with `noUncheckedIndexedAccess` enabled
- Use inline `type` imports: `import { type Foo } from "bar"`
- Prefix unused parameters with underscore: `(_unused) => {}`
- Never use `any`; prefer `unknown` when type is truly unknown
- Do not use non-null assertions (`!`) or type casting to bypass errors

### Imports

- Use the `~/` path alias for all src imports: `import { cn } from "~/lib/utils"`
- Use inline type imports: `import { type ComponentProps } from "react"`
- Never import directly from `clsx`; use `cn` from `~/lib/utils` (enforced by ESLint)

### Naming Conventions

- Component files: `kebab-case.tsx` (e.g., `server-status.tsx`, `query-tool.tsx`)
- Component names: `PascalCase` (e.g., `export function ServerStatus()`)
- Hook files: `use-*.ts` (kebab-case with `use-` prefix) in `src/hooks/`
- Types/interfaces: `PascalCase` (e.g., `LogEntry`, `FilterValue`)
- Constants: `UPPER_SNAKE_CASE` for arrays/enums (e.g., `TIME_RANGES`)

### React Components

- Use function declarations with named exports (not `React.FC` or arrow functions)
- Add `"use client"` directive only when needed (hooks, browser APIs, event handlers)
- Destructure props in the function signature

```tsx
// Good
export function MyComponent({ title, onClick }: MyComponentProps) {
  return <button onClick={onClick}>{title}</button>;
}

// Avoid
export const MyComponent: React.FC<MyComponentProps> = (props) => {
  return <button onClick={props.onClick}>{props.title}</button>;
};
```

### Styling

- Use Tailwind CSS classes exclusively (v4, CSS-based config in `globals.css`)
- Use `cn()` from `~/lib/utils` for conditional class merging
- Tailwind classes are auto-sorted by `prettier-plugin-tailwindcss`

### tRPC

- Routers go in `src/server/api/routers/`
- Use `publicProcedure` for endpoints
- Validate inputs with Zod schemas
- Access client via `api` from `~/trpc/react`

```tsx
const { data, isLoading } = api.blocky.blockingStatus.useQuery();
const mutation = api.blocky.blockingEnable.useMutation({
  onSuccess: () => void utils.blocky.blockingStatus.invalidate(),
});
```

### Error Handling

- Use try/catch for async operations that may fail
- Provide user-friendly error messages
- Use `toast` from `sonner` for user notifications (`toast.success()`, `toast.error()`)

### shadcn/ui Components

Components in `src/components/ui/` are generated by shadcn CLI. Ask for permission before editing.
If a component exists in shadcn, add it instead of creating one manually:

```bash
bunx shadcn@latest add <component-name>
```

When doing so, be careful with the --overwrite flag, since some components may have manual changes, which would break by replacing them with that flag.

## Formatting & Linting Rules

- 2-space indentation, LF line endings
- Drizzle: always use `where` clause with `delete` and `update` (enforced by ESLint). Don't use raw queries, unless absolutely necessary, prefer using the ORM functions.
- Report unused ESLint disable directives

## Environment Variables

Validated via `@t3-oss/env-nextjs` in `src/env.js`. Key variables:

- `BLOCKY_API_URL` — Blocky API URL (default: `http://localhost:4000`)
- `QUERY_LOG_TYPE` — Log provider: `mysql`, `csv`, or `csv-client`
- `QUERY_LOG_TARGET` — DB connection string or directory path
- `DEMO_MODE` — Enables MSW mock data (boolean, default: `false`)
- `PROMETHEUS_PATH` — Metrics endpoint path (default: `/metrics`)

Never commit secrets. Use `.env` for local development. Use `SKIP_ENV_VALIDATION=true` for builds that don't need runtime env vars.

## Git Workflow

CI runs on all PRs to main:

1. **CI job**: `bun run ci` (lint + format + typecheck)
2. **Integration Tests job**: `bun run test` (Vitest with testcontainers, 15min timeout)

Ensure `bun run ci` passes before pushing.
