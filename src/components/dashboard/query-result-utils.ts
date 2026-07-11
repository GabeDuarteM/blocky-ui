const BLOCKED_REASON_PATTERN = /^BLOCKED(?: [^(]+)? \((.*)\)$/i;

function getBlockingGroup(reason: string): string | null {
  const match = BLOCKED_REASON_PATTERN.exec(reason.trim());
  const detail = match?.[1];
  if (!detail) {
    return null;
  }

  const separatorIndex = detail.indexOf(": ");
  if (separatorIndex <= 0) {
    return null;
  }

  return detail.slice(0, separatorIndex);
}

export function getQueryResultDetail(
  responseType: string,
  reason: string,
): string | null {
  if (responseType.toUpperCase() === "BLOCKED") {
    return getBlockingGroup(reason);
  }

  if (reason.toUpperCase() === responseType.toUpperCase()) {
    return null;
  }

  return reason;
}
