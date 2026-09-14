import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContributionTitle } from "../contribution-title";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

const commit = "[`abc1234`](https://github.com/org/repo/commit/abc1234)";
const credit = `[#42](https://github.com/org/repo/pull/42) ${commit} Thanks [@gabe](https://github.com/gabe)!`;

describe("contribution titles", () => {
  it("prefers the linked PR title over the commit title", () => {
    vi.mocked(execFileSync).mockReturnValue(
      "fix: improve PostgreSQL pagination\n",
    );
    expect(getContributionTitle(credit)).toBe(
      "fix: improve PostgreSQL pagination",
    );
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith(
      "gh",
      ["api", "repos/org/repo/pulls/42", "--jq", ".title"],
      { encoding: "utf8" },
    );
  });

  it("requests only the commit's first line when there is no PR", () => {
    vi.mocked(execFileSync).mockReturnValue("fix: use existing index\n");
    expect(getContributionTitle(commit)).toBe("fix: use existing index");
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith(
      "gh",
      [
        "api",
        "repos/org/repo/commits/abc1234",
        "--jq",
        '.commit.message | split("\\n")[0]',
      ],
      { encoding: "utf8" },
    );
  });

  it("keeps title Markdown and HTML literal within one list entry", () => {
    vi.mocked(execFileSync).mockReturnValue(
      "fix: `request_ts` <details>\n[link](url)\n",
    );
    expect(getContributionTitle(credit)).toBe(
      "fix: \\`request\\_ts\\` \\<details\\> \\[link\\](url)",
    );
  });

  it("keeps author-only credits without inventing a title", () => {
    expect(
      getContributionTitle("Thanks [@gabe](https://github.com/gabe)!"),
    ).toBeUndefined();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("fails preparation when a title lookup fails or returns no title", () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw new Error("GitHub unavailable");
    });
    expect(() => getContributionTitle(credit)).toThrow("GitHub unavailable");
    vi.mocked(execFileSync).mockReturnValue("\n");
    expect(() => getContributionTitle(credit)).toThrow(
      "Missing contribution title",
    );
  });
});
