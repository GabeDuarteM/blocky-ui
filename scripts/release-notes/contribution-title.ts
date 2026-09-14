import { execFileSync } from "node:child_process";

export function getContributionTitle(credit: string) {
  const pull = /\]\(https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\)/.exec(
    credit,
  );
  const commit =
    /\]\(https:\/\/github\.com\/([^/]+\/[^/]+)\/commit\/([a-f0-9]+)\)/.exec(
      credit,
    );
  const source = pull ?? commit;
  if (!source) {
    return undefined;
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
