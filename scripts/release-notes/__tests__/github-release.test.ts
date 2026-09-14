import { describe, expect, it } from "vitest";
import { formatGithubRelease } from "../github-release";

const wrap = (body: string) =>
  `# blocky-ui\n\n## 2.1.0\n\n${body}\n\n## 2.0.0\n\n### Older release\n\nOld content.\n`;

describe("GitHub release formatting", () => {
  it("promotes every heading by two levels and keeps the changelog unchanged", () => {
    const changelog = wrap(
      "### Highlights\n\n#### Multiple servers\n\n##### Configuration\n\n###### Example\n\n  ##### Nested heading\n\n    ### Indented code\n\n### Contributions\n\n- By [@gabe](https://github.com/gabe)",
    );
    const original = changelog;
    const result = formatGithubRelease(changelog, "2.1.0");
    expect(result).toBe(
      "# Highlights\n\n## Multiple servers\n\n### Configuration\n\n#### Example\n\n  ### Nested heading\n\n    ### Indented code\n\n# Contributions\n\n- By @gabe",
    );
    expect(changelog).toBe(original);
    expect(formatGithubRelease(changelog, "2.1.0")).toBe(result);
  });

  it("preserves headings and author links inside nested fenced examples", () => {
    const code =
      "````md\n## 2.0.0\n### Example heading\n```\n[@gabe](https://github.com/gabe)\n````\n\n~~~md\n## Another example\n#### Leave this alone\n~~~";
    const result = formatGithubRelease(
      wrap(`### Examples\n\n${code}\n\n### Contributions`),
      "2.1.0",
    );
    expect(result).toBe(`# Examples\n\n${code}\n\n# Contributions`);
  });

  it("selects the requested release and fails when it is absent", () => {
    const changelog = wrap("### Latest release");
    expect(formatGithubRelease(changelog, "2.0.0")).toBe(
      "# Older release\n\nOld content.",
    );
    expect(() => formatGithubRelease(changelog, "1.0.0")).toThrow(
      "Cannot find changelog",
    );
  });
});
