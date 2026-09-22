import { closesCodeFence, readCodeFence } from "./code-fence";

const releaseHeadingPattern = /^## /;
const releaseSubheadingPattern = /^( {0,3})(#{3,6})(?=\s|$)/;

export function formatGithubRelease(changelog: string, version: string) {
  const notes: string[] = [];
  let inRelease = false;
  let fence: string | undefined;

  for (const line of changelog.split("\n")) {
    const marker = readCodeFence(line)?.marker;
    if (fence && closesCodeFence(line, marker, fence)) {
      fence = undefined;
    } else {
      fence ??= marker;
    }
    if (fence || marker) {
      if (inRelease) {
        notes.push(line);
      }
      continue;
    }
    if (line.trimEnd() === `## ${version}`) {
      inRelease = true;
      continue;
    }
    if (!inRelease) {
      continue;
    }
    if (releaseHeadingPattern.test(line)) {
      break;
    }
    notes.push(
      line
        .replace(
          releaseSubheadingPattern,
          (_match, indent: string, heading: string) =>
            `${indent}${heading.slice(2)}`,
        )
        .replace(/\[@([a-zA-Z0-9_-]+)\]\(https:\/\/github\.com\/\1\)/g, "@$1"),
    );
  }
  if (!inRelease) {
    throw new Error(`Cannot find changelog for version ${version}.`);
  }
  return notes.join("\n").trim();
}
