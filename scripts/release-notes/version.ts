import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { getFirstTimeContributors } from "./contributors";
import { formatChangelog } from "./format";

async function readVersion() {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  return z.object({ version: z.string() }).parse(manifest).version;
}

async function prepareRelease() {
  const changesets = (await readdir(".changeset"))
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => `.changeset/${name}`);
  const originals = await Promise.all(
    ["package.json", "CHANGELOG.md", ...changesets].map(async (path) => ({
      path,
      content: await readFile(path),
    })),
  );
  try {
    const previousVersion = await readVersion();
    execFileSync("bun", ["run", "changeset", "version"], { stdio: "inherit" });
    const version = await readVersion();
    if (version !== previousVersion) {
      const changelog = await readFile("CHANGELOG.md", "utf8");
      const firstTimeContributors = getFirstTimeContributors({
        repo: process.env.GITHUB_REPOSITORY ?? "{owner}/{repo}",
        version,
        previousVersion,
        targetCommitish:
          process.env.GITHUB_SHA ??
          execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
      });
      await writeFile(
        "CHANGELOG.md",
        formatChangelog(changelog, version, firstTimeContributors),
      );
    }
  } catch (error) {
    await Promise.all(
      originals.map(({ path, content }) => writeFile(path, content)),
    );
    throw error;
  }
}

try {
  await prepareRelease();
} catch (error) {
  console.error("Could not prepare release notes:", error);
  process.exitCode = 1;
}
