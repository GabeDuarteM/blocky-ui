"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FlaskConical, Server } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { DemoSetupProvider, useDemoSetupController } from "~/demo/context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DEMO_SETUPS, getDemoSetup } from "~/demo/config";
import { TRPCReactProvider } from "~/trpc/react";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  return (
    <DemoSetupProvider>
      <DemoModeContent>{children}</DemoModeContent>
    </DemoSetupProvider>
  );
}

function DemoModeContent({ children }: { children: ReactNode }) {
  const { setup } = useDemoSetupController();

  return (
    <TRPCReactProvider demoSetupId={setup.id}>
      <DemoModeShell>{children}</DemoModeShell>
    </TRPCReactProvider>
  );
}

function DemoModeShell({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(true);
  const { setup } = useDemoSetupController();
  const queryClient = useQueryClient();
  const previousSetupId = useRef(setup.id);

  useEffect(() => {
    if (previousSetupId.current === setup.id) {
      return;
    }

    previousSetupId.current = setup.id;
    void queryClient.resetQueries();
  }, [queryClient, setup.id]);

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
  const { setup, setSetup } = useDemoSetupController();

  const handleSetupChange = (value: string) => {
    setSetup(getDemoSetup(value));
  };

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
            {setup.label}
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
            Preview setup states
          </p>
        </div>
      </div>

      <Select value={setup.id} onValueChange={handleSetupChange}>
        <SelectTrigger
          aria-label="Demo setup"
          size="sm"
          className="h-9 w-full border-white/10 bg-white/5 text-zinc-100 sm:w-52"
        >
          <Server className="size-3.5 text-zinc-400" />
          <SelectValue>{setup.label}</SelectValue>
        </SelectTrigger>
        <SelectContent align="center" className="min-w-72">
          {DEMO_SETUPS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <span className="flex flex-col items-start">
                <span>{option.label}</span>
                <span className="text-muted-foreground text-xs">
                  {option.description}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
