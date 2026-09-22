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
import { expect, it } from "vitest";
import config from "../../../.changeset/config.json";

it.each(["none", "github", "markdown"])(
  "prepares a release and restores failed attempts: %s failure",
  async (failure) => {
    const directory = await mkdtemp(join(tmpdir(), "blocky-release-test-"));
    const script = fileURLToPath(new URL("../version.ts", import.meta.url));
    try {
      await mkdir(join(directory, ".changeset"));
      const bin = join(directory, "bin");
      await mkdir(bin);
      const gh = join(bin, "gh");
      const githubResponse = `#!/bin/sh
printf '%s\\n' '## New Contributors' '* @new-user made their first contribution in https://github.com/org/repo/pull/42'
`;
      await writeFile(
        gh,
        failure === "github" ? "#!/bin/sh\nexit 1\n" : githubResponse,
      );
      await chmod(gh, 0o755);
      const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        GITHUB_SHA: "fixture-source-sha",
      };
      await symlink(
        join(process.cwd(), "node_modules"),
        join(directory, "node_modules"),
        "dir",
      );
      const manifest = JSON.stringify({
        name: "blocky-ui",
        version: "1.0.0",
        private: true,
        scripts: { changeset: "bun x @changesets/cli" },
      });
      await writeFile(join(directory, "package.json"), manifest);
      await writeFile(
        join(directory, ".changeset/config.json"),
        JSON.stringify(config),
      );
      const changeset =
        '---\n"blocky-ui": patch\n---\n\nMultiple servers\n\n## Highlights\n\nManage several servers.\n';
      const input =
        failure === "markdown"
          ? changeset.replace("Highlights", "Highligths")
          : changeset;
      await writeFile(join(directory, ".changeset/feature.md"), input);
      const history = "## 1.0.0\n\n- Original release.\n";
      const changelog = `# blocky-ui\n\n${history}`;
      await writeFile(join(directory, "CHANGELOG.md"), changelog);

      if (failure !== "none") {
        expect(() =>
          execFileSync("bun", [script], { cwd: directory, stdio: "pipe", env }),
        ).toThrow("Command failed");
        expect(await readFile(join(directory, "package.json"), "utf8")).toBe(
          manifest,
        );
        expect(await readFile(join(directory, "CHANGELOG.md"), "utf8")).toBe(
          changelog,
        );
        expect(
          await readFile(join(directory, ".changeset/feature.md"), "utf8"),
        ).toBe(input);
        await writeFile(gh, githubResponse);
        await writeFile(join(directory, ".changeset/feature.md"), changeset);
      }

      execFileSync("bun", [script], { cwd: directory, stdio: "pipe", env });
      const result = await readFile(join(directory, "CHANGELOG.md"), "utf8");
      expect(result).toContain(
        "## 1.0.1\n\n### Highlights\n\n#### Multiple servers\n\nManage several servers.",
      );
      expect(result.endsWith(history)).toBe(true);
      expect(result).toContain(
        "### First-time contributors\n\n* @new-user made their first contribution in https://github.com/org/repo/pull/42",
      );
      await expect(
        readFile(join(directory, ".changeset/feature.md")),
      ).rejects.toMatchObject({ code: "ENOENT" });
      expect(() =>
        execFileSync("bun", [script], { cwd: directory, stdio: "pipe", env }),
      ).toThrow("Command failed");
      expect(await readFile(join(directory, "CHANGELOG.md"), "utf8")).toBe(
        result,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  30_000,
);
