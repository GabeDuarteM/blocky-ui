import { closesCodeFence, readCodeFence } from "./code-fence";
import { getContributionTitle } from "./contribution-title";

const headingPattern = /^#{1,6} /;
const creditPattern =
  /^ {2}<!-- changeset-credit: ([^|]*)\|([^|]*)\|([^|]*) -->$/;
const entryIndentPattern = /^ {2}/;
const changeTypeHeadingPattern = /^### (Major|Minor|Patch) Changes$/;
const releaseHeadingPattern = /^## /m;
const rawChangesetPattern = /^\s*### (Major|Minor|Patch) Changes\n/;

const SECTIONS = [
  "Upgrade notes",
  "Highlights",
  "Other improvements",
  "Deprecations",
] as const;
type Section = (typeof SECTIONS)[number];

function splitSections(markdown: string) {
  const sections = new Map<Section, string[]>();
  let section: Section = "Other improvements";
  let fence: { marker: string; indent: number } | undefined;
  const outputFence = "`".repeat(
    Math.max(
      3,
      ...Array.from(markdown.matchAll(/`+/g), (match) => match[0].length + 1),
    ),
  );

  for (const line of markdown.split("\n")) {
    const opening = readCodeFence(line);
    const marker = opening?.marker;
    let output = line;
    if (fence) {
      if (closesCodeFence(line, marker, fence.marker)) {
        output = " ".repeat(fence.indent) + outputFence;
        fence = undefined;
      } else {
        output =
          " ".repeat(fence.indent) +
          line.replace(new RegExp(`^ {0,${fence.indent}}`), "");
      }
    } else if (marker) {
      fence = { marker, indent: opening?.indent ?? 0 };
      output =
        " ".repeat(fence.indent) +
        outputFence +
        line.trimStart().slice(marker.length);
    } else if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      const nextSection = SECTIONS.find((name) => name === heading);
      if (!nextSection) {
        throw new Error(`Unknown release-note section: ${heading}`);
      }
      section = nextSection;
      continue;
    } else if (headingPattern.test(line)) {
      if (!(line.startsWith("### ") || line.startsWith("#### "))) {
        throw new Error("Use ### or #### for headings inside release notes.");
      }
      output = sectionHeading(line, section);
    }
    const lines = sections.get(section) ?? [];
    lines.push(output);
    sections.set(section, lines);
  }
  if (fence) {
    throw new Error("Unclosed code fence in release notes.");
  }
  return sections;
}

function parseEntry(entry: string) {
  const [title = "", metadata = "", ...lines] = entry.split("\n");
  const fields = metadata.match(creditPattern);
  if (!(title && fields)) {
    throw new Error(`Cannot read Changesets entry: ${title}`);
  }
  const [, pull, commit, authors] = fields;
  const credit = [pull, commit, authors ? `by ${authors}` : ""]
    .filter(Boolean)
    .join(" ");
  const body = lines
    .map((line) => line.replace(entryIndentPattern, ""))
    .join("\n");
  return { title, credit, sections: splitSections(body) };
}

function readEntries(markdown: string) {
  const entries: string[] = [];
  for (const line of markdown.trim().split("\n")) {
    if (changeTypeHeadingPattern.test(line)) {
      continue;
    }
    if (line.startsWith("- ")) {
      entries.push(line.slice(2));
    } else if (entries.length > 0) {
      entries[entries.length - 1] += `\n${line}`;
    } else if (line.trim()) {
      throw new Error(`Unexpected Changesets output: ${line}`);
    }
  }
  if (entries.length === 0) {
    throw new Error("No release-note entries found.");
  }

  return entries;
}

function groupEntries(entries: string[]) {
  const grouped = new Map<Section, string[]>();
  const contributions = new Set<string>();
  for (const entry of entries) {
    const { title, credit, sections } = parseEntry(entry);
    let hasContent = false;
    for (const [section, lines] of sections) {
      const body = lines.join("\n").trim();
      if (!body) {
        continue;
      }
      hasContent = true;
      const content = sectionContent(body, title, section);
      grouped.set(section, [...(grouped.get(section) ?? []), content]);
    }
    if (!hasContent) {
      grouped.set("Other improvements", [
        ...(grouped.get("Other improvements") ?? []),
        `- ${title}`,
      ]);
    }
    if (credit) {
      const contributionTitle = getContributionTitle(credit);
      contributions.add(
        contributionTitle
          ? `- ${contributionTitle} · ${credit}`
          : `- ${credit}`,
      );
    }
  }
  return { contributions, grouped };
}

function formatEntries(markdown: string, firstTimeContributors: string) {
  const { grouped, contributions } = groupEntries(readEntries(markdown));
  const result: string[] = [];
  for (const section of SECTIONS) {
    const entries = grouped.get(section);
    if (entries?.length) {
      const heading =
        section === "Other improvements" && !grouped.has("Highlights")
          ? "Improvements"
          : section;
      result.push(`### ${heading}\n\n${entries.join("\n\n")}`);
    }
  }
  if (firstTimeContributors.trim()) {
    result.push(
      `### First-time contributors\n\n${firstTimeContributors.trim()}`,
    );
  }
  if (contributions.size > 0) {
    result.push(`### Contributions\n\n${[...contributions].join("\n")}`);
  }
  return result.join("\n\n");
}

export function formatChangelog(
  changelog: string,
  version: string,
  firstTimeContributors = "",
) {
  const heading = `## ${version}\n`;
  const start = changelog.indexOf(heading);
  if (start < 0) {
    throw new Error(`Cannot find changelog for version ${version}.`);
  }
  const bodyStart = start + heading.length;
  const nextRelease = changelog.slice(bodyStart).search(releaseHeadingPattern);
  const end = nextRelease < 0 ? changelog.length : bodyStart + nextRelease;
  const body = changelog.slice(bodyStart, end);
  if (!rawChangesetPattern.test(body)) {
    return changelog;
  }
  return `${changelog.slice(0, bodyStart)}\n${formatEntries(body, firstTimeContributors)}\n\n${changelog.slice(end)}`;
}

function sectionHeading(line: string, section: Section) {
  const prefix =
    section === "Highlights" || section === "Other improvements" ? "##" : "#";
  return `${prefix}${line}`;
}

function sectionContent(body: string, title: string, section: Section) {
  if (section === "Other improvements") {
    return `- ${title}\n\n${body.replace(/^(?=.)/gm, "  ")}`;
  }
  if (section === "Highlights") {
    return `#### ${title}\n\n${body}`;
  }
  return body;
}
