import path from "node:path";
import changelog from "@changesets/changelog-github";
import { readChangesets } from "@changesets/read";
import { expect, it } from "vitest";
import config from "../../../.changeset/config.json";
import packageJson from "../../../package.json";
import { formatChangelog } from "../format";
import { formatGithubRelease } from "../github-release";

const root = path.resolve(import.meta.dirname, "../../..");
const version = "0.0.0";
// changelog-github resolves these directives through the GitHub API. They only change the credit line, which this test doesn't check.
const pullDirective = /^\s*(?:pr|pull|pull\s+request):\s*#?\d+/imu;
const commitDirective = /^\s*commit:\s*\S+/imu;

it("renders every pending changeset into release notes", async () => {
  const releases = (await readChangesets(root)).flatMap((changeset) =>
    changeset.releases.flatMap(({ name, type }) =>
      name === packageJson.name && type !== "none" ? [{ changeset, type }] : [],
    ),
  );

  await Promise.all(
    releases.map(async ({ changeset, type }) => {
      const render = async () => {
        const entry = await changelog.getReleaseLine(
          {
            ...changeset,
            summary: changeset.summary
              .replace(pullDirective, "")
              .replace(commitDirective, ""),
          },
          type,
          config.changelog.find((option) => typeof option === "object") ?? null,
        );
        const notes = formatChangelog(
          `# ${packageJson.name}\n\n## ${version}\n\n### Patch Changes\n\n${entry.trim()}\n`,
          version,
        );
        return formatGithubRelease(notes, version);
      };
      await expect.soft(render(), changeset.id).resolves.toBeTruthy();
    }),
  );
});
