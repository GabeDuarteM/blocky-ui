---
name: generate-changeset
description: Changesets for blocky-ui. Use when the user requests a changeset or release-note draft for repository changes.
---

# Generate changeset

1. Read [.changeset/README.md](../../../.changeset/README.md), `.changeset/config.json`,
   and `package.json`. Compare the requested changes with pending changesets so
   each user-facing change is covered once.
2. Use a comparable consumed changeset's final revision before deletion for wording
   and level of detail. The README takes precedence over historical formatting.
3. For uncovered changes, create files with `bun run changeset --empty`. Apply the bump policy below and
   the README's format. Multiple changesets per PR are valid: split independent
   user-facing changes or different bump types; keep related implementation details
   together.
4. Check the completed entries against the requested changes and README. Report
   the files and their bumps, or existing coverage if no new entry was needed.

## Bump policy

- `patch`: bug fixes, dependency/CVE bumps, docs/config clarifications, and performance
  improvements that do not add a user-facing capability.
- `minor`: new provider support, new configuration options, new filters, new
  dashboard sections, or any meaningful new feature.
- `major`: breaking configuration changes, removed compatibility, migrations users
  must perform immediately, or behavior that breaks existing setups.

When in doubt between `patch` and `minor`, choose based on user-visible capability:
fixes and optimizations are `patch`; new features and supported integrations are
`minor`.

## Writing reference

- Include tables only when comparing measurable before/after results.
- For visual changes, include screenshots using supplied GitHub attachment or Imgur
  URLs. When screenshots are missing, use clearly labeled temporary placeholders
  from https://placehold.co/ and report this to the user.

For a requested dry-run, follow the README's [preview instructions](../../../.changeset/README.md#previewing-a-release).
