"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";
import { DEFAULT_DEMO_SETUP, type DemoSetup } from "~/demo/config";

type DemoModeContextValue = {
  setup: DemoSetup;
  setSetup: Dispatch<SetStateAction<DemoSetup>>;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoSetupProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<DemoSetup>(DEFAULT_DEMO_SETUP);
  const value = useMemo(() => ({ setup, setSetup }), [setup]);

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoSetup(): DemoSetup {
  return useContext(DemoModeContext)?.setup ?? DEFAULT_DEMO_SETUP;
}

export function useDemoSetupController(): DemoModeContextValue {
  const context = useContext(DemoModeContext);

  if (!context) {
    throw new Error("Demo setup controls require DemoSetupProvider.");
  }

  return context;
}
