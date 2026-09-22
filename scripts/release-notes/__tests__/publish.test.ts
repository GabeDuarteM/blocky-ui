import { execFileSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("updates only the published GitHub release from the unchanged changelog", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "blocky-release-publish-test-"),
  );
  try {
    const bin = join(directory, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "gh"),
      `#!/bin/sh
printf '%s\\n' "$@" > args.txt
cat > notes.md
`,
    );
    await chmod(join(bin, "gh"), 0o755);
    const changelog =
      "# blocky-ui\n\n## 2.1.0\n\n### Highlights\n\n#### Multiple servers\n\n## 2.0.0\n\n### Older release\n";
    await writeFile(join(directory, "CHANGELOG.md"), changelog);
    execFileSync(
      "bun",
      [fileURLToPath(new URL("../publish.ts", import.meta.url))],
      {
        cwd: directory,
        stdio: "pipe",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          PUBLISHED_PACKAGES: JSON.stringify([
            { name: "blocky-ui", version: "2.1.0" },
          ]),
        },
      },
    );
    expect(await readFile(join(directory, "args.txt"), "utf8")).toBe(
      "release\nedit\nv2.1.0\n--notes-file\n-\n",
    );
    expect(await readFile(join(directory, "notes.md"), "utf8")).toBe(
      "# Highlights\n\n## Multiple servers",
    );
    expect(await readFile(join(directory, "CHANGELOG.md"), "utf8")).toBe(
      changelog,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
