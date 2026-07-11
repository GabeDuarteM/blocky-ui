"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FlaskConical, Server } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { DEMO_SERVICES, serializeDemoConfiguration } from "~/demo/config";
import {
  DemoConfigurationProvider,
  useDemoConfigurationController,
} from "~/demo/context";
import { TRPCReactProvider } from "~/trpc/react";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  return (
    <DemoConfigurationProvider>
      <DemoModeContent>{children}</DemoModeContent>
    </DemoConfigurationProvider>
  );
}

function DemoModeContent({ children }: { children: ReactNode }) {
  const { configuration } = useDemoConfigurationController();
  const serializedConfiguration = serializeDemoConfiguration(configuration);

  return (
    <TRPCReactProvider demoConfiguration={serializedConfiguration}>
      <DemoModeShell>{children}</DemoModeShell>
    </TRPCReactProvider>
  );
}

function DemoModeShell({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(true);
  const { configuration } = useDemoConfigurationController();
  const serializedConfiguration = serializeDemoConfiguration(configuration);
  const queryClient = useQueryClient();
  const previousConfiguration = useRef(serializedConfiguration);

  useEffect(() => {
    if (previousConfiguration.current === serializedConfiguration) {
      return;
    }

    previousConfiguration.current = serializedConfiguration;
    void queryClient.resetQueries();
  }, [queryClient, serializedConfiguration]);

  return (
    <>
      <div className={isMinimized ? "pb-28 sm:pb-16" : "pb-60 sm:pb-24"}>
        {children}
      </div>
      <DemoDevtoolsBar
        isMinimized={isMinimized}
        onMinimizedChange={setIsMinimized}
      />
    </>
  );
}

function DemoDevtoolsBar({
  isMinimized,
  onMinimizedChange,
}: {
  isMinimized: boolean;
  onMinimizedChange: (isMinimized: boolean) => void;
}) {
  const { configuration, setServiceEnabled } = useDemoConfigurationController();
  const enabledServices = DEMO_SERVICES.filter(
    ({ id }) => configuration.services[id],
  );
  const selectionLabel = getSelectionLabel(
    enabledServices.map((service) => service.label),
  );

  if (isMinimized) {
    return (
      <aside
        aria-label="Demo configuration"
        className="pointer-events-none fixed inset-x-3 bottom-16 z-40 flex justify-center sm:bottom-3"
      >
        <Button
          aria-label="Expand demo configuration"
          variant="outline"
          onClick={() => onMinimizedChange(false)}
          className="pointer-events-auto h-10 rounded-full border-amber-400/25 bg-zinc-950/95 px-3 text-zinc-100 shadow-2xl shadow-black/40 backdrop-blur hover:bg-zinc-900 hover:text-zinc-100"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-amber-400 text-zinc-950">
            <FlaskConical className="size-3.5" />
          </span>
          <span className="text-[10px] font-semibold tracking-[0.16em] text-amber-300 uppercase">
            Demo
          </span>
          <span className="h-4 w-px bg-white/10" />
          <span className="max-w-40 truncate text-xs text-zinc-300">
            {selectionLabel}
          </span>
          <ChevronUp className="size-3.5 text-zinc-500" />
        </Button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Demo configuration"
      className="fixed inset-x-3 bottom-16 z-40 flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-zinc-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur sm:inset-x-auto sm:bottom-3 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:px-3"
    >
      <div className="flex shrink-0 items-center gap-2 pr-10 sm:pr-0">
        <span className="flex size-7 items-center justify-center rounded-full bg-amber-400 text-zinc-950">
          <FlaskConical className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-amber-300 uppercase">
            Demo mode
          </p>
          <p className="hidden text-xs text-zinc-400 sm:block">
            Toggle services
          </p>
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label="Demo services"
            variant="outline"
            className="h-9 w-full justify-between border-white/10 bg-white/5 px-3 text-zinc-100 hover:bg-white/10 hover:text-zinc-100 sm:w-52"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Server className="size-3.5 shrink-0 text-zinc-400" />
              <span className="truncate">{selectionLabel}</span>
            </span>
            <ChevronUp className="size-3.5 shrink-0 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="top"
          className="w-72 border-white/10 bg-zinc-950 p-1 text-zinc-100"
        >
          <div aria-label="Enabled demo services" role="group">
            {DEMO_SERVICES.map((service) => (
              <label
                key={service.id}
                htmlFor={`demo-service-${service.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 hover:bg-white/5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{service.label}</span>
                  <span className="block text-xs text-zinc-500">
                    {service.description}
                  </span>
                </span>
                <Switch
                  id={`demo-service-${service.id}`}
                  aria-label={`${service.label} enabled`}
                  checked={configuration.services[service.id]}
                  onCheckedChange={(enabled) =>
                    setServiceEnabled(service.id, enabled)
                  }
                  className="data-[state=checked]:bg-amber-400"
                />
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        aria-label="Minimize demo configuration"
        size="icon"
        variant="ghost"
        onClick={() => onMinimizedChange(true)}
        className="absolute top-2 right-2 size-8 rounded-full text-zinc-500 hover:bg-white/10 hover:text-zinc-200 sm:static"
      >
        <ChevronDown className="size-4" />
      </Button>
    </aside>
  );
}

function getSelectionLabel(enabledServiceLabels: string[]): string {
  if (enabledServiceLabels.length === 0) {
    return "No services";
  }

  if (enabledServiceLabels.length === DEMO_SERVICES.length) {
    return "Complete setup";
  }

  if (enabledServiceLabels.length === 1) {
    return enabledServiceLabels[0] ?? "1 service";
  }

  return `${enabledServiceLabels.length} services`;
}
