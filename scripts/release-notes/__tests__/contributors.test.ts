import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFirstTimeContributors } from "../contributors";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const release = {
  repo: "org/repo",
  version: "2.1.0",
  previousVersion: "2.0.0",
  targetCommitish: "release-source-sha",
};

beforeEach(() => vi.clearAllMocks());

describe("first-time contributors", () => {
  it("requests the exact release range without creating a release", () => {
    vi.mocked(execFileSync).mockReturnValue(
      "## What's Changed\r\n* Existing change\r\n\r\n## New Contributors\r\n* @new-user made their first contribution in https://github.com/org/repo/pull/42\r\n\r\n**Full Changelog**: https://github.com/org/repo/compare/v2.0.0...v2.1.0\r\n",
    );
    expect(getFirstTimeContributors(release)).toBe(
      "* @new-user made their first contribution in https://github.com/org/repo/pull/42",
    );
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith(
      "gh",
      [
        "api",
        "--method",
        "POST",
        "repos/org/repo/releases/generate-notes",
        "-f",
        "tag_name=v2.1.0",
        "-f",
        "previous_tag_name=v2.0.0",
        "-f",
        "target_commitish=release-source-sha",
        "--jq",
        ".body",
      ],
      { encoding: "utf8" },
    );
  });

  it("omits a missing section and stops at the next section", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("## What's Changed\n* Existing contribution\n")
      .mockReturnValueOnce(
        "## New Contributors\n* @new-user made their first contribution in https://github.com/org/repo/pull/42\n\n## Other section\nOther content",
      );
    expect(getFirstTimeContributors(release)).toBe("");
    expect(getFirstTimeContributors(release)).not.toContain("Other section");
  });

  it("propagates API failures instead of reporting no first-time contributors", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("GitHub API unavailable");
    });
    expect(() => getFirstTimeContributors(release)).toThrow(
      "GitHub API unavailable",
    );
  });
});
