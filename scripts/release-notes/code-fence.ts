const fencePattern = /^(?<indent> {0,3})(?<marker>`{3,}|~{3,})/u;

export function readCodeFence(line: string) {
  const match = line.match(fencePattern);
  const marker = match?.groups?.marker;
  return marker
    ? { indent: match?.groups?.indent?.length ?? 0, marker }
    : undefined;
}

export function closesCodeFence(
  line: string,
  marker: string | undefined,
  opening: string,
) {
  return Boolean(
    marker &&
      marker[0] === opening[0] &&
      marker.length >= opening.length &&
      line.trim() === marker,
  );
}
