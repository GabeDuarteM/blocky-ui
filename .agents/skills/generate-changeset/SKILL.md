---
name: generate-changeset
description: Generate Changesets release-note files that match this repository's package name, semver bump policy, and historical changelog style. Use when the user asks to create, write, add, or draft a changeset, release note, or .changeset entry for code changes in blocky-ui.
---

# Generate Changeset

## Quick Start

1. Inspect the change:
   - Check `git status --short`.
   - Read `git diff` and `git diff --staged` as applicable.
   - If the user named commits, branches, or files, inspect those instead.
2. Inspect the local Changesets setup:
   - Read `.changeset/config.json`.
   - Read `package.json` for the package name.
   - Review current `.changeset/*.md` files to avoid duplicate coverage.
3. Inspect historical style before writing:
   - Use Git history for `.changeset`, including deleted files, not only currently pending files.
   - Prefer the final version of each consumed changeset just before it was deleted by a release.
4. Generate the changeset file with the Changesets CLI with `bun run changeset --empty`, then edit the generated file

## Changesets Basics

A changeset records three things:

- What package needs to be released.
- What semver bump type it needs.
- What changelog text should be published.

Changesets are markdown files with YAML frontmatter. The body can be as much markdown as needed and is included in the changelog on publish. Use the CLI to create the file, then replace the generated body/frontmatter as needed.

## Bump Choice

- `patch`: bug fixes, dependency/CVE bumps, docs/config clarifications, and performance improvements that do not add a user-facing capability.
- `minor`: new provider support, new configuration options, new filters, new dashboard sections, or any meaningful user-facing capability.
- `major`: breaking configuration changes, removed compatibility, migrations users must perform immediately, or behavior that intentionally breaks existing setups.

When in doubt between `patch` and `minor`, choose based on user-visible capability: fixes and optimizations are `patch`; new features and supported integrations are `minor`.

## Writing Style

Match this repository's historical changesets:

- Start with a concise, user-facing sentence in imperative or plain release-note style.
- Explain what changed, why it matters, and how users should update configuration or usage when relevant.
- Prefer concrete nouns: provider names, env vars, UI areas, data sources, and affected workflows.
- Mention the practical outcome, not just the implementation.
- Keep simple fixes to one sentence.
- For larger features, add `####` sections such as `#### Configuration`, `#### Before and After`, or feature-specific headings.
- Include code fences for environment variables, YAML, shell commands, or examples users may copy.
- Include tables only when comparing measurable before/after results.
- Include screenshots when the changes impact the app visually. Generate the changeset with placeholders from https://placehold.co/ and ask the user to replace it with imgur images (e.g. https://github.com/GabeDuarteM/blocky-ui/releases/tag/v1.5.0).
- Use deprecation notices when old env vars, registries, or behavior remain temporarily supported but should be replaced.
- Avoid raw commit-message prefixes like `feat:` or `fix:` unless the user explicitly wants it.

## Multiple Changesets

More than one changeset in a PR is valid. Use separate changesets when:

- Separate user-facing changes deserve separate changelog entries.
- Distinct changes should have different semver bump types.

Keep related implementation details together when they produce one coherent user-facing outcome.

## Content Checklist

Before finalizing:

- The changeset covers only the relevant change and does not duplicate an existing pending changeset.
- The frontmatter package name and bump type match the repo.
- The body explains user impact clearly enough for a changelog reader.
- New env vars or setup changes include exact names and a short example.
- Breaking or deprecating changes state what users need to change.
- Markdown fences are closed and the file has a trailing newline.
- Images are present when relevant
