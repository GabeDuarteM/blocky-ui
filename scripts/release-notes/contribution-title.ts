import { execFileSync } from "node:child_process";

const pullRequestPattern =
  /\]\(https:\/\/github\.com\/(?<repo>[^/]+\/[^/]+)\/pull\/(?<id>\d+)\)/u;
const commitPattern =
  /\]\(https:\/\/github\.com\/(?<repo>[^/]+\/[^/]+)\/commit\/(?<id>[a-f0-9]+)\)/u;

export function getContributionTitle(credit: string) {
  const pull = credit.match(pullRequestPattern);
  const commit = credit.match(commitPattern);
  const source = pull ?? commit;
  if (!source) {
    return;
  }
  const title = execFileSync(
    "gh",
    [
      "api",
      `repos/${source.groups?.repo}/${pull ? "pulls" : "commits"}/${source.groups?.id}`,
      "--jq",
      pull ? ".title" : '.commit.message | split("\\n")[0]',
    ],
    { encoding: "utf8" },
  ).trim();
  if (!title) {
    throw new Error(`Missing contribution title for ${source[0]}`);
  }
  return title.replace(/\r?\n/gu, " ").replace(/[\\`*_[\]<>]/gu, "\\$&");
}
