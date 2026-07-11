import { z } from "zod";

const queryResponseSchema = z.object({
  reason: z.string(),
  response: z.string(),
  responseType: z.string(),
  returnCode: z.string(),
});

const BLOCKED_REASON_PATTERN = /^BLOCKED(?: [^(]+)? \((.*)\)$/i;
const BLOCKING_GROUP_PATTERN = /(?:^|, )([^,:]+): /g;

export interface BlockyQueryResult {
  responseType: string;
  returnCode: string;
  answers: string[];
  detail: string | null;
}

function parseAnswers(response: string): string[] {
  if (!response) {
    return [];
  }

  return response.split(/,\s+(?=[A-Z0-9]+\s+\()/).map((record) => {
    const match = /^[A-Z0-9]+\s+\((.*)\)$/.exec(record);
    return match?.[1] ?? record;
  });
}

function parseBlockingGroups(reason: string): string[] {
  const reasonMatch = BLOCKED_REASON_PATTERN.exec(reason.trim());
  const details = reasonMatch?.[1];
  if (!details) {
    return [];
  }

  return Array.from(details.matchAll(BLOCKING_GROUP_PATTERN), (match) =>
    match[1]?.trim(),
  ).filter((group): group is string => Boolean(group));
}

function getDetail(responseType: string, reason: string): string | null {
  if (responseType.toUpperCase() === "BLOCKED") {
    const groups = parseBlockingGroups(reason);
    return groups.length > 0 ? groups.join(", ") : null;
  }

  if (reason.toUpperCase() === responseType.toUpperCase()) {
    return null;
  }

  return reason;
}

export function parseBlockyQueryResult(value: unknown): BlockyQueryResult {
  const result = queryResponseSchema.parse(value);

  return {
    responseType: result.responseType,
    returnCode: result.returnCode,
    answers: parseAnswers(result.response),
    detail: getDetail(result.responseType, result.reason),
  };
}
