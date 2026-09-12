"use client";

import { useServerCommand } from "~/hooks/use-server-command";
import { ActionLayout } from "~/components/dashboard/action-layout";

import { type ReactNode } from "react";

import { Activity, Shield, XCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function Operations({ controls }: { controls?: ReactNode }) {
  const command = useServerCommand("maintenance");
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
              variant="outline"
              className="flex w-full items-center gap-2"
              onClick={() => void command.execute({ action: "clearCache" })}
              disabled={command.isPending}
            >
              <XCircle className="h-4 w-4" />
              Clear DNS Cache
            </Button>
            <Button
              variant="outline"
              className="flex w-full items-center gap-2"
              onClick={() => void command.execute({ action: "refreshLists" })}
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
