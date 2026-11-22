import { execFileSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, onTestFinished } from "vitest";
import config from "../../../.changeset/config.json";

const script = fileURLToPath(new URL("../version.ts", import.meta.url));
const githubResponse = `#!/bin/sh
printf '%s\\n' '## New Contributors' '* @new-user made their first contribution in https://github.com/org/repo/pull/42'
`;
const manifest = JSON.stringify({
  name: "blocky-ui",
  version: "1.0.0",
  private: true,
  scripts: { changeset: "bun x @changesets/cli" },
});
const changeset =
  '---\n"blocky-ui": patch\n---\n\nMultiple servers\n\n## Highlights\n\nManage several servers.\n';
const history = "## 1.0.0\n\n- Original release.\n";
const changelog = `# blocky-ui\n\n${history}`;
const releaseFiles = ["package.json", "CHANGELOG.md", ".changeset/feature.md"];

async function createRelease() {
  const directory = await mkdtemp(join(tmpdir(), "blocky-release-test-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const read = (path: string) => readFile(join(directory, path), "utf8");
  const write = (path: string, content: string) =>
    writeFile(join(directory, path), content);

  await mkdir(join(directory, ".changeset"));
  await mkdir(join(directory, "bin"));
  await write("bin/gh", githubResponse);
  await chmod(join(directory, "bin/gh"), 0o755);
  await symlink(
    join(process.cwd(), "node_modules"),
    join(directory, "node_modules"),
    "dir",
  );
  await write("package.json", manifest);
  await write(".changeset/config.json", JSON.stringify(config));
  await write(".changeset/feature.md", changeset);
  await write("CHANGELOG.md", changelog);

  const env = {
    ...process.env,
    PATH: `${join(directory, "bin")}:${process.env.PATH}`,
    GITHUB_SHA: "fixture-source-sha",
  };
  const version = () =>
    execFileSync("bun", [script], { cwd: directory, stdio: "pipe", env });
  return { read, write, version };
}

it("prepares a release", { timeout: 30_000 }, async () => {
  const release = await createRelease();

  release.version();

  const result = await release.read("CHANGELOG.md");
  expect(result).toContain(
    "## 1.0.1\n\n### Highlights\n\n#### Multiple servers\n\nManage several servers.",
  );
  expect(result.endsWith(history)).toBe(true);
  expect(result).toContain(
    "### First-time contributors\n\n* @new-user made their first contribution in https://github.com/org/repo/pull/42",
  );
  await expect(release.read(".changeset/feature.md")).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect(() => release.version()).toThrow("Command failed");
  expect(await release.read("CHANGELOG.md")).toBe(result);
});

it.each([
  { failure: "github", path: "bin/gh", content: "#!/bin/sh\nexit 1\n" },
  {
    failure: "markdown",
    path: ".changeset/feature.md",
    content: changeset.replace("Highlights", "Highligths"),
  },
])(
  "restores the release files after a $failure failure",
  { timeout: 30_000 },
  async ({ path, content }) => {
    const release = await createRelease();
    const original = await release.read(path);
    await release.write(path, content);
    const before = await Promise.all(releaseFiles.map(release.read));

    expect(() => release.version()).toThrow("Command failed");
    expect(await Promise.all(releaseFiles.map(release.read))).toEqual(before);

    await release.write(path, original);
    release.version();
    expect(await release.read("CHANGELOG.md")).toContain("## 1.0.1");
  },
);
