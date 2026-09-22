const fencePattern = /^( {0,3})(`{3,}|~{3,})/;

export function readCodeFence(line: string) {
  const match = line.match(fencePattern);
  const marker = match?.[2];
  return marker ? { indent: match?.[1]?.length ?? 0, marker } : undefined;
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
