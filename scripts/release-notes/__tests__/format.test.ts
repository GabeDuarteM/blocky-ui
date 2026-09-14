import changelog from "@changesets/changelog-github";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { formatChangelog } from "../format";
import { formatGithubRelease } from "../github-release";
import config from "../../../.changeset/config.json";

vi.mock("../contribution-title", () => ({
  getContributionTitle: vi.fn(() => "feat: support multiple servers"),
}));

const server = setupServer(
  http.post("https://api.github.com/graphql", () =>
    HttpResponse.json({
      data: {
        repo__0: {
          commit__abc1234: {
            commitUrl: "https://github.com/org/repo/commit/abc1234",
            associatedPullRequests: {
              nodes: [
                {
                  number: 42,
                  url: "https://github.com/org/repo/pull/42",
                  mergedAt: "2026-09-01T00:00:00Z",
                  author: { login: "gabe", url: "https://github.com/gabe" },
                },
              ],
            },
          },
        },
      },
    }),
  ),
);
beforeAll(() => {
  vi.stubEnv("GITHUB_TOKEN", "test-token");
  server.listen({ onUnhandledRequest: "error" });
});
afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});

async function release(
  summary: string,
  type: "major" | "minor" | "patch" = "patch",
  commit: string | null = "abc1234",
) {
  const entry = await changelog.getReleaseLine(
    {
      id: "test",
      summary,
      releases: [{ name: "blocky-ui", type }],
      commit: commit ?? undefined,
    },
    type,
    {
      ...config.changelog.find((option) => typeof option === "object"),
      repo: "org/repo",
    },
  );
  return `### ${type[0]?.toUpperCase()}${type.slice(1)} Changes\n\n${entry.trim()}`;
}

const history =
  "## 1.0.0\n\n### Patch Changes\n\n- Leave this historical release alone.\n";
function document(body: string) {
  return `# blocky-ui\n\n## 2.0.0\n\n${body}\n\n${history}`;
}

describe("release notes", () => {
  it.each([
    "Thanks for improving startup.",
    "Thanks for improving startup - including cold starts.",
    "[#42](https://github.com/org/repo/pull/42) - explain the new behavior.",
    "[`abc1234`](https://github.com/org/repo/commit/abc1234) - document the fix.",
    "Thanks [@gabe](https://github.com/gabe)! - explain the improvement.",
  ])("keeps credit-like titles as prose: %s", async (title) => {
    const input = await release(`${title}\n\nMore details.`, "patch", null);
    const result = formatChangelog(document(input), "2.0.0");
    expect(result).toContain(
      `### Improvements\n\n- ${title}\n\n  More details.`,
    );
    expect(result).not.toContain("### Contributions");
    expect(result).not.toContain("<!-- changeset-credit:");
  });

  it("keeps a credit-like title separate from real generated credits", async () => {
    const title = "Thanks [@gabe](https://github.com/gabe)! - improve startup.";
    const result = formatChangelog(document(await release(title)), "2.0.0");
    expect(result).toContain(`### Improvements\n\n- ${title}`);
    expect(result).toContain(
      "### Contributions\n\n- feat: support multiple servers · [#42]",
    );
    expect(result).not.toContain("<!-- changeset-credit:");
  });

  it.each([
    "Fix query filtering.",
    "Fix query filtering.\n\n## Other improvements\n\nHandle empty filters.",
    "Fix query filtering.\n\n## Highlights\n\n## Other improvements\n\nHandle empty filters.",
  ])(
    "uses Improvements when no highlights have content: %s",
    async (summary) => {
      const result = formatChangelog(document(await release(summary)), "2.0.0");
      expect(result).toContain("### Improvements\n\n- Fix query filtering.");
      expect(result).not.toMatch(/^### (Highlights|Other improvements)$/m);
      expect(formatGithubRelease(result, "2.0.0")).toMatch(/^# Improvements\n/);
      expect(formatChangelog(result, "2.0.0")).toBe(result);
      expect(result.endsWith(history)).toBe(true);
    },
  );

  it("groups explicit sections independently of bump type and keeps all attribution", async () => {
    const feature = await release(
      "Multiple servers\n\n## Highlights\n\nManage several servers.\n\n![Dashboard](https://example.com/dashboard.png)\n\n## Upgrade notes\n\nSwitch to YAML.",
      "patch",
    );
    const improvement = await release("Recognize REBIND responses.", "minor");
    const result = formatChangelog(
      document(`${feature}\n\n${improvement}`),
      "2.0.0",
    );
    expect(result).toBe(
      `# blocky-ui\n\n## 2.0.0\n\n### Upgrade notes\n\nSwitch to YAML.\n\n### Highlights\n\n#### Multiple servers\n\nManage several servers.\n\n![Dashboard](https://example.com/dashboard.png)\n\n### Other improvements\n\n- Recognize REBIND responses.\n\n### Contributions\n\n- feat: support multiple servers · [#42](https://github.com/org/repo/pull/42) [\`abc1234\`](https://github.com/org/repo/commit/abc1234) by [@gabe](https://github.com/gabe)\n\n${history}`,
    );
    expect(formatChangelog(result, "2.0.0")).toBe(result);
  });

  it("orders notices by urgency without repeating feature titles", async () => {
    const feature = await release(
      "Multiple servers\n\n## Deprecations\n\n### Environment variables\n\nEnvironment variables still work but will be removed later.\n\n## Highlights\n\nManage multiple servers.\n\n## Upgrade notes\n\n### Required database migration\n\nRun migrations before starting.\n\n#### Backup\n\nBack up the database first.",
      "major",
    );
    const improvement = await release("Fix filtering.");
    const result = formatChangelog(
      document(`${feature}\n\n${improvement}`),
      "2.0.0",
      "* @new-user made their first contribution in https://github.com/org/repo/pull/40",
    );
    expect(result.match(/^### .+$/gm)).toEqual([
      "### Upgrade notes",
      "### Highlights",
      "### Other improvements",
      "### Deprecations",
      "### First-time contributors",
      "### Contributions",
      "### Patch Changes",
    ]);
    expect(result).toContain(
      "### Upgrade notes\n\n#### Required database migration\n\nRun migrations before starting.\n\n##### Backup",
    );
    expect(result).toContain(
      "### Deprecations\n\n#### Environment variables\n\nEnvironment variables still work but will be removed later.",
    );
    expect(result.match(/^#### Multiple servers$/gm)).toHaveLength(1);
    const simple = formatChangelog(document(improvement), "2.0.0");
    expect(simple).not.toMatch(/^### (Upgrade notes|Deprecations)$/m);
  });

  it("preserves fenced examples, tables, nested lists and subsection headings", async () => {
    const body = [
      "## Highlights",
      "",
      "### Configuration",
      "",
      "````md",
      "## Not a section",
      "```",
      "- Example",
      "````",
      "",
      "~~~sh",
      "## Still code",
      "~~~",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| A | B |",
      "",
      "- One",
      "  - Two",
    ].join("\n");
    const result = formatChangelog(
      document(await release(`Configuration\n\n${body}`)),
      "2.0.0",
    );
    expect(result).toContain(
      body
        .replaceAll("````", "`````")
        .replaceAll("~~~", "`````")
        .replace(
          "## Highlights\n\n### Configuration",
          "### Highlights\n\n#### Configuration\n\n##### Configuration",
        ),
    );
    expect(result.endsWith(history)).toBe(true);
    expect(formatChangelog(result, "2.0.0")).toBe(result);
  });

  it("keeps fenced examples inside their list item", async () => {
    const body =
      "- Run this command:\n\n  ```sh\n  echo hello\n  ```\n\n  Then check the result.\n\n- Continue with setup.";
    const result = formatChangelog(
      document(await release(`Setup\n\n## Highlights\n\n${body}`)),
      "2.0.0",
    );
    expect(result).toContain(body.replaceAll("```", "````"));
  });

  it("keeps legacy prose and entries without GitHub metadata", async () => {
    const result = formatChangelog(
      document(
        await release(
          "[Read documentation](https://example.com)\n\nMore details.\n\n- First\n- Second",
          "patch",
          null,
        ),
      ),
      "2.0.0",
    );
    expect(result).toContain(
      "### Improvements\n\n- [Read documentation](https://example.com)\n\n  More details.\n\n  - First\n  - Second",
    );
    expect(result).not.toContain("### Contributions");
  });

  it("rejects misspelled sections and unfinished examples", async () => {
    for (const body of [
      "## Highligths\n\nDetails",
      "## Highlights\n\n```sh\ncommand",
    ]) {
      const input = document(await release(`Title\n\n${body}`));
      expect(() => formatChangelog(input, "2.0.0")).toThrow();
    }
  });

  it("places first-time contributors before contributions and omits empty sections", async () => {
    const input = document(await release("Fix query filtering."));
    const newContributors =
      "* @new-user made their first contribution in https://github.com/org/repo/pull/40";
    const result = formatChangelog(input, "2.0.0", newContributors);
    expect(result).toContain(
      `### First-time contributors\n\n${newContributors}\n\n### Contributions`,
    );
    expect(result.endsWith(history)).toBe(true);
    expect(formatChangelog(input, "2.0.0", " ")).not.toContain(
      "### First-time contributors",
    );
  });

  it("fails on an absent version rather than overwriting history", () => {
    expect(() => formatChangelog(history, "2.0.0")).toThrow(
      "Cannot find changelog",
    );
  });
});
