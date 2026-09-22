import { execFileSync } from "node:child_process";

const pullRequestPattern =
  /\]\(https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\)/;
const commitPattern =
  /\]\(https:\/\/github\.com\/([^/]+\/[^/]+)\/commit\/([a-f0-9]+)\)/;

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
      `repos/${source[1]}/${pull ? "pulls" : "commits"}/${source[2]}`,
      "--jq",
      pull ? ".title" : '.commit.message | split("\\n")[0]',
    ],
    { encoding: "utf8" },
  ).trim();
  if (!title) {
    throw new Error(`Missing contribution title for ${source[0]}`);
  }
  return title.replace(/\r?\n/g, " ").replace(/[\\`*_[\]<>]/g, "\\$&");
}
