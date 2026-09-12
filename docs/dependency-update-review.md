# Consolidated dependency updates

Reviewed on 2026-09-12. Local branch: `t3code/consolidate-update-prs`.

Base: `34476525cec4e90d8b01780ce5e21994f85cae45` from `origin/main`.

The nine included updates are ready to merge together from this branch.

This branch combines the requested versions from the ten open Renovate PRs, with TypeScript 7 excluded. The separate feature PRs are outside this dependency update batch. No remote branches or PRs were changed.

## PR decisions

| PR                                                        | Update                              | Decision                                 | Reviewed head                              |
| --------------------------------------------------------- | ----------------------------------- | ---------------------------------------- | ------------------------------------------ |
| [#249](https://github.com/GabeDuarteM/blocky-ui/pull/249) | eslint to v10                       | Included with fixes below                | `ef74bdeddd16d33bdffe7244f75e02e02ecbfee2` |
| [#363](https://github.com/GabeDuarteM/blocky-ui/pull/363) | lucide-react to v1.45.0             | Included                                 | `38a35a867411fb56aadf66573c0beb920a7ac87e` |
| [#376](https://github.com/GabeDuarteM/blocky-ui/pull/376) | mysql2 to v3.24.4                   | Included                                 | `c1391a756a6198429c474c905493081e8ad247cd` |
| [#380](https://github.com/GabeDuarteM/blocky-ui/pull/380) | typescript to v7                    | Excluded: incompatible TypeScript parser | `eb07a04f1c168b6b0dc55e7427c6888bc2857a73` |
| [#403](https://github.com/GabeDuarteM/blocky-ui/pull/403) | radix-ui-primitives monorepo        | Included                                 | `3bbc3d121360dd5a21628a5d9b5d015fee387643` |
| [#404](https://github.com/GabeDuarteM/blocky-ui/pull/404) | recharts to v3.10.1                 | Included                                 | `b21d2fa78c5e822e50ab6aac38ad673cd5190654` |
| [#406](https://github.com/GabeDuarteM/blocky-ui/pull/406) | better-sqlite3 to v13               | Included with fixes below                | `42a175ea099d63340757fa39dda91417e29bfe53` |
| [#409](https://github.com/GabeDuarteM/blocky-ui/pull/409) | next to v16.3.5                     | Included with fixes below                | `6e69d1641cb86aa93b5f48062ffb10be4e9a058e` |
| [#413](https://github.com/GabeDuarteM/blocky-ui/pull/413) | react monorepo to v19.3.0           | Included                                 | `dec9d6991dd7abea022f7c94156f86f83854049c` |
| [#420](https://github.com/GabeDuarteM/blocky-ui/pull/420) | tanstack-query monorepo to v5.102.8 | Included                                 | `c96c4386a69be556ebad0e4a7f43d8e855363abd` |

The updates in #249 and #406 require this branch's fixes before merging. The original PRs do not contain them. #380 remains excluded.

## Compatibility fixes

- ESLint 10.10.0 crashed while loading `react/display-name` because the plugin calls the removed `context.getFilename()` API. Wrap the existing configuration with `@eslint/compat` 2.1.1. All configured rules remain enabled. Negative lint probes confirm React display names, Hooks rules, both Drizzle write guards, and restricted imports still report violations.
- Match `eslint-config-next` 16.3.5 to Next.js 16.3.5.
- SQLite 13.0.3 bundles Node-API binaries under `prebuilds/`. The old Docker stage expects `build/Release/better_sqlite3.node`, which no longer exists after installation. Select the target platform's bundled musl binary, execute a SQL smoke check during the image build, and copy it to the new runtime path.
- A fresh Bun 1.3.14 install invokes `node-gyp` for SQLite's `binding.gyp`, despite the bundled binaries. Add `node-gyp` 12.2.0 as a development dependency so fresh local and Docker installs work without a global tool. Knip records this implicit use.

## Test setup fixes

- Expose MySQL's X Protocol port `33060` in the integration fixture. Podman includes this image port as an unbound entry in `HostConfig.PortBindings`; Testcontainers 12 otherwise times out waiting for it. The provider still connects through port `3306`.
- Wait for PostgreSQL's two ready messages and final TCP listener instead of engine-scheduled health checks. The database accepted connections while Podman left its health status unchanged.
- Allow five minutes for the provider suite's setup hook so cold images and Podman vfs storage can initialize. Individual assertion timeouts and the cleanup timeout are unchanged.

## Deferred update

Do not merge #380 as written. TypeScript 7.0.2 crashes the TypeScript ESLint parser during module loading with `Cannot read properties of undefined (reading 'Cjs')`. This was present in its GitHub CI log and reproduced locally with the combined updates. Retaining TypeScript 6.0.3 restores linting. The [parser's documented support range](https://typescript-eslint.io/users/dependency-versions/) is `>=4.8.4 <6.1.0`. A separate compiler/tooling migration is needed before replacing the `typescript` dependency with v7.

The ESLint fix follows the [official compatibility utilities](https://github.com/eslint/rewrite/tree/main/packages/compat) and [ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0).

## Validation

- `bun install --frozen-lockfile --force` in a fresh directory: passed, 849 packages. This reproduced the missing `node-gyp` failure before the fix and passed afterward.
- `bun run verify`: passed, including ESLint, Prettier, TypeScript, Knip, and duplication checks.
- `bun run test`: **421 tests passed across 6 files**, with no skipped tests. This includes the real MySQL, PostgreSQL, SQLite, CSV, CSV-client, and VictoriaLogs provider conformance tests.
- `SKIP_ENV_VALIDATION=true bun run build`: passed with Next.js 16.3.5, including TypeScript checking.
- Production standalone server: a real SQLite database returned its seeded DNS query through `/api/trpc/blocky.getQueryLogs`.
- Production browser checks: dashboard statistics and charts; DNS lookup; blocking disable/enable; cache clearing and list reloads; chart time ranges and filter suggestions; query-log domain filtering with keyboard selection; reason selection; demo service toggles, API-unavailable state, and recovery. Checked desktop and 390-pixel mobile layout. No uncaught browser errors; the intentional API outage produced the expected tRPC error logs. Mobile document width matched the viewport.
- Negative lint probes confirmed that the ESLint compatibility wrapper preserves `react/display-name`, `react-hooks/rules-of-hooks`, both Drizzle write guards, and `no-restricted-imports`.
- Complete Alpine image build: passed using `podman build --build-arg BETTER_SQLITE3_VERSION=13.0.3 -t localhost/blocky-ui-updates:review .`. The native stage executed a SQL query against the bundled musl binary.
- Final container: passed the SQLite tRPC query, dashboard HTML, and stylesheet HTTP checks while running as the image's non-root user. Image ID: `f1dd5ec87dd45564b0b667fbc494e1541a2b707497814f74dd5e0b6768399db5`.

Executable image validation covered Linux/amd64. The ARM64 binary and target-selection path were inspected, but an ARM64 image was not executed.

This workspace runs inside a container and uses rootless Podman. The successful full test command was:

```bash
DOCKER_HOST=unix:///tmp/blocky-update-review/podman.sock \
TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1 \
TESTCONTAINERS_RYUK_DISABLED=true \
bun run test
```

The host override avoids Testcontainers selecting an unreachable container gateway. These are local runtime settings, not application configuration. Initial baseline and combined runs failed during container setup; the successful result above includes all assertions.

Local logs and browser screenshots are in `/tmp/blocky-update-review/`.
