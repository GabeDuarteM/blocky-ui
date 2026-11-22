import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useServerCommand } from "~/hooks/use-server-command";

const mocks = vi.hoisted(() => ({
  statusKey: ["blockingStatus", "home"],
  useQueryClient: vi.fn(),
  currentStatus: vi.fn(),
  mutateAsync: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: mocks.useQueryClient,
  useMutation: () => ({ mutateAsync: mocks.mutateAsync }),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    servers: {
      command: { mutationOptions: () => ({}) },
      blockingStatus: {
        pathFilter: () => ({ queryKey: ["blockingStatus"] }),
        queryOptions: (_input: unknown, options?: { staleTime?: number }) => ({
          queryKey: mocks.statusKey,
          queryFn: mocks.currentStatus,
          ...options,
        }),
      },
      statistics: { pathFilter: () => ({ queryKey: ["statistics"] }) },
    },
  }),
}));

vi.mock("~/components/dashboard/server-context", () => ({
  useDashboardServers: () => ({
    servers: [{ id: "home", name: "Home" }],
    selection: { selected: () => ["home"] },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: mocks.error },
}));

it("checks current blocking state before retrying despite a fresh cached status", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });
  let retry: (() => void) | undefined;

  mocks.error.mockImplementation(
    (_message: string, options: { action?: { onClick: () => void } }) => {
      retry = options.action?.onClick;
    },
  );
  mocks.useQueryClient.mockReturnValue(client);
  mocks.currentStatus.mockResolvedValue([
    { serverId: "home", success: true, data: { enabled: false } },
  ]);
  mocks.mutateAsync
    .mockResolvedValueOnce([
      { serverId: "home", success: false, error: { kind: "timeout" } },
    ])
    .mockResolvedValueOnce([{ serverId: "home", success: true }]);

  const command = useServerCommand("blocking");

  await command.execute({ action: "enable" });

  client.setQueryData(mocks.statusKey, [
    { serverId: "home", success: true, data: { enabled: true } },
  ]);

  expect(retry).toBeDefined();
  retry?.();

  await vi.waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));
  expect(mocks.currentStatus).toHaveBeenCalledOnce();
  expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
    serverIds: ["home"],
    command: { action: "enable" },
  });

  client.clear();
});
