export function normalizeLogTimestamp(
  value: string | null,
  timezone: "utc" | "local" = "utc",
): string | null {
  if (!value) {
    return null;
  }
  let normalized = value.replace(" ", "T");
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized += ":00";
  } else if (timezone === "utc" && !/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    normalized += "Z";
  }
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
