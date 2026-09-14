export function formatGithubRelease(changelog: string, version: string) {
  const notes: string[] = [];
  let inRelease = false;
  let fence: string | undefined;

  for (const line of changelog.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (inRelease) {
        notes.push(line);
      }
      if (
        marker &&
        marker[0] === fence[0] &&
        marker.length >= fence.length &&
        line.trim() === marker
      ) {
        fence = undefined;
      }
      continue;
    }
    if (marker) {
      fence = marker;
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
    if (/^## /.test(line)) {
      break;
    }
    notes.push(
      line
        .replace(
          /^( {0,3})(#{3,6})(?=\s|$)/,
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
