# Release notes

Create a changeset with `bun run changeset`. Choose the version bump for
`blocky-ui`, then write the note using the format below. The bump controls
versioning; sections control where the note appears.

## Writing a note

For a small improvement, one sentence is enough:

```markdown
---
"blocky-ui": patch
---

Recognize REBIND responses in query logs.
```

For a feature, start with a short title, then add the sections it needs:

````markdown
---
"blocky-ui": minor
---

Multiple Blocky servers

## Highlights

Manage several Blocky servers from one dashboard, with combined query history.

### Configuration

```yaml
servers:
  home:
    url: http://blocky:4000
```

## Deprecations

### Environment-variable configuration

Environment variables still work, but support will be removed in a future major
release. Move your configuration to YAML.
````

Use these exact section markers. Empty sections are omitted, and the output
follows this order:

| Section marker          | Use for                                                 |
| ----------------------- | ------------------------------------------------------- |
| `## Upgrade notes`      | Breaking changes and required actions before upgrading. |
| `## Highlights`         | Features, each headed by its changeset title.           |
| `## Other improvements` | Smaller changes. Plain notes go here automatically.     |
| `## Deprecations`       | Future removals while the old behavior still works.     |

The output calls the section "Improvements" when there are no highlights, and
"Other improvements" when there are. Keep using `## Other improvements` in changesets.

Upgrade notes and Deprecations omit the changeset title. Add a specific `###`
notice heading when useful. Within descriptions, use `###` or `####` headings;
images, tables, lists, and fenced code blocks are supported. Use separate
changesets for features that need separate highlight titles.

First-time contributors and Contributions are added automatically after these
sections. Contributions use the PR title, or the commit's first line when there
is no PR, with available PR, commit, and author links as `by @author`.
Contributions cover changesets; first-time contributors can also include PRs
without changesets. Leave both sections to the generator.

## Previewing a release

The release workflow handles formatting automatically. To preview it locally, run
`bun run release:version` in a disposable checkout with the intended changesets
and GitHub authentication for Changesets and `gh`. Inspect its `CHANGELOG.md`.
This command bumps the version locally and consumes changesets in that checkout.

The changelog keeps `###` section headings under each `##` version. GitHub releases
promote headings by two levels.
`release:format` edits published GitHub releases, so it is not a preview command.
