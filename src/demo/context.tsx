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
  type DemoServerCount,
} from "~/demo/config";

type DemoConfigurationContextValue = {
  configuration: DemoConfiguration;
  setServerCount: (count: DemoServerCount) => void;
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
        ...current,
        services: {
          ...current.services,
          [service]: enabled,
        },
      }));
    },
    [],
  );
  const setServerCount = useCallback((serverCount: DemoServerCount) => {
    setConfiguration((current) => ({ ...current, serverCount }));
  }, []);
  const value = useMemo(
    () => ({ configuration, setServiceEnabled, setServerCount }),
    [configuration, setServiceEnabled, setServerCount],
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
