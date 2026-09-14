import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { formatGithubRelease } from "./github-release";

try {
  const packages = z
    .array(z.object({ version: z.string() }))
    .parse(JSON.parse(process.env.PUBLISHED_PACKAGES ?? ""));
  const changelog = await readFile("CHANGELOG.md", "utf8");
  for (const { version } of packages) {
    const notes = formatGithubRelease(changelog, version);
    execFileSync(
      "gh",
      ["release", "edit", `v${version}`, "--notes-file", "-"],
      {
        input: notes,
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
  }
} catch (error) {
  console.error("Could not format GitHub release notes:", error);
  process.exitCode = 1;
}
