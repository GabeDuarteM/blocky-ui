"use client";

import { Activity, Shield, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { ActionLayout } from "~/components/dashboard/action-layout";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useServerCommand } from "~/hooks/use-server-command";

export function Operations({ controls }: { controls?: ReactNode }) {
  const command = useServerCommand("maintenance");
  const clearCache = useCallback(
    () => command.execute({ action: "clearCache" }),
    [command],
  );
  const refreshLists = useCallback(
    () => command.execute({ action: "refreshLists" }),
    [command],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Operations
          </span>
        </CardTitle>
        <CardDescription>
          Perform maintenance operations on the DNS server
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionLayout controls={controls}>
          <div className="space-y-2">
            <Button
              size="responsive"
              variant="outline"
              className="flex w-full items-center gap-2"
              onClick={clearCache}
              disabled={command.isPending}
            >
              <XCircle className="h-4 w-4" />
              Clear DNS Cache
            </Button>
            <Button
              size="responsive"
              variant="outline"
              className="flex w-full items-center gap-2"
              onClick={refreshLists}
              disabled={command.isPending}
            >
              <Shield className="h-4 w-4" />
              Reload Allow/Denylists
            </Button>
          </div>
        </ActionLayout>
      </CardContent>
    </Card>
  );
}
