import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useServerCommand } from "~/hooks/use-server-command";

const mocks = vi.hoisted(() => ({
  useUtils: vi.fn(),
  mutateAsync: vi.fn(),
  error: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: mocks.useUtils,
    servers: {
      command: {
        useMutation: () => ({ mutateAsync: mocks.mutateAsync }),
      },
    },
  },
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
  const queryKey = ["blockingStatus", "home"];
  const currentStatus = vi.fn(async () => [
    { serverId: "home", success: true, data: { enabled: false } },
  ]);
  let retry: (() => void) | undefined;

  mocks.error.mockImplementation(
    (_message: string, options: { action?: { onClick: () => void } }) => {
      retry = options.action?.onClick;
    },
  );
  mocks.useUtils.mockReturnValue({
    servers: {
      blockingStatus: {
        invalidate: vi.fn(),
        fetch: (_input: unknown, options?: { staleTime?: number }) =>
          client.fetchQuery({ queryKey, queryFn: currentStatus, ...options }),
      },
      statistics: { invalidate: vi.fn() },
    },
  });
  mocks.mutateAsync
    .mockResolvedValueOnce([
      { serverId: "home", success: false, error: { kind: "timeout" } },
    ])
    .mockResolvedValueOnce([{ serverId: "home", success: true }]);

  const command = useServerCommand("blocking");

  await command.execute({ action: "enable" });

  client.setQueryData(queryKey, [
    { serverId: "home", success: true, data: { enabled: true } },
  ]);

  expect(retry).toBeDefined();
  retry?.();

  await vi.waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));
  expect(currentStatus).toHaveBeenCalledOnce();
  expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
    serverIds: ["home"],
    command: { action: "enable" },
  });

  client.clear();
});
