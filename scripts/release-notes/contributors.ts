import { execFileSync } from "node:child_process";

export function getFirstTimeContributors({
  repo,
  version,
  previousVersion,
  targetCommitish,
}: {
  repo: string;
  version: string;
  previousVersion: string;
  targetCommitish: string;
}) {
  const notes = execFileSync(
    "gh",
    [
      "api",
      "--method",
      "POST",
      `repos/${repo}/releases/generate-notes`,
      "-f",
      `tag_name=v${version}`,
      "-f",
      `previous_tag_name=v${previousVersion}`,
      "-f",
      `target_commitish=${targetCommitish}`,
      "--jq",
      ".body",
    ],
    { encoding: "utf8" },
  );
  return (
    notes
      .replaceAll("\r\n", "\n")
      .split(/^## New Contributors\n/m)[1]
      ?.split(/^## |^\*\*Full Changelog\*\*:/m)[0]
      ?.trim() ?? ""
  );
}
