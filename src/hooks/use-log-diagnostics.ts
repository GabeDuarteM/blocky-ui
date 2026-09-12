"use client";

import { useEffect, useId } from "react";
import { useDashboardServers } from "~/components/dashboard/server-context";

export function useLogDiagnostics(
  key: string,
  diagnostics: { sourceId: string; message: string }[] | undefined,
) {
  const id = useId();
  const reportKey = `${key}-${id}`;
  const report = useDashboardServers().reportDiagnostics;
  useEffect(() => {
    report?.(reportKey, diagnostics ?? []);
  }, [reportKey, diagnostics, report]);
  useEffect(() => () => report?.(reportKey, []), [reportKey, report]);
}
