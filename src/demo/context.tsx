"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_DEMO_CONFIGURATION,
  type DemoConfiguration,
  type DemoService,
} from "~/demo/config";

type DemoConfigurationContextValue = {
  configuration: DemoConfiguration;
  setServiceEnabled: (service: DemoService, enabled: boolean) => void;
};

const DemoConfigurationContext =
  createContext<DemoConfigurationContextValue | null>(null);

export function DemoConfigurationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [configuration, setConfiguration] = useState<DemoConfiguration>(
    DEFAULT_DEMO_CONFIGURATION,
  );
  const setServiceEnabled = useCallback(
    (service: DemoService, enabled: boolean) => {
      setConfiguration((current) => ({
        services: {
          ...current.services,
          [service]: enabled,
        },
      }));
    },
    [],
  );
  const value = useMemo(
    () => ({ configuration, setServiceEnabled }),
    [configuration, setServiceEnabled],
  );

  return (
    <DemoConfigurationContext.Provider value={value}>
      {children}
    </DemoConfigurationContext.Provider>
  );
}

export function useDemoConfiguration(): DemoConfiguration {
  return (
    useContext(DemoConfigurationContext)?.configuration ??
    DEFAULT_DEMO_CONFIGURATION
  );
}

export function useDemoConfigurationController(): DemoConfigurationContextValue {
  const context = useContext(DemoConfigurationContext);

  if (!context) {
    throw new Error(
      "Demo configuration controls require DemoConfigurationProvider.",
    );
  }

  return context;
}
