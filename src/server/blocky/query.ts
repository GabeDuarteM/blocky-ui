import { z } from "zod";

const queryResponseSchema = z.object({
  reason: z.string(),
  response: z.string(),
  responseType: z.string(),
  returnCode: z.string(),
});

const BLOCKED_REASON_PATTERN = /^BLOCKED(?: [^(]+)? \((.*)\)$/i;

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

function parseBlockingGroup(reason: string): string | null {
  const reasonMatch = BLOCKED_REASON_PATTERN.exec(reason.trim());
  const details = reasonMatch?.[1];
  if (!details) {
    return null;
  }

  const separatorIndex = details.indexOf(": ");
  if (separatorIndex <= 0) {
    return null;
  }

  return details.slice(0, separatorIndex);
}

function getDetail(responseType: string, reason: string): string | null {
  if (responseType.toUpperCase() === "BLOCKED") {
    return parseBlockingGroup(reason);
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
