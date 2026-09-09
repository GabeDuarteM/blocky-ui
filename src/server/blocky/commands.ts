import { type KyInstance } from "ky";
import { z } from "zod";

const blockingStatusSchema = z.object({
  enabled: z.boolean(),
  disabledGroups: z.array(z.string()).optional(),
  autoEnableInSec: z.number().min(0).optional(),
});

export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable") }),
  z.object({
    action: z.literal("disable"),
    duration: z.string().optional(),
    groups: z.string().optional(),
  }),
  z.object({ action: z.literal("clearCache") }),
  z.object({ action: z.literal("refreshLists") }),
]);

export async function readBlockingStatus(client: KyInstance) {
  return blockingStatusSchema.parse(
    await client.get("api/blocking/status").json(),
  );
}

export async function executeCommand(
  client: KyInstance,
  command: z.infer<typeof commandSchema>,
) {
  switch (command.action) {
    case "enable":
      await client.get("api/blocking/enable");
      break;
    case "disable": {
      const searchParams = new URLSearchParams();
      if (command.duration) {
        searchParams.set("duration", command.duration);
      }
      if (command.groups) {
        searchParams.set("groups", command.groups);
      }
      await client.get("api/blocking/disable", { searchParams });
      break;
    }
    case "clearCache":
      await client.post("api/cache/flush");
      break;
    case "refreshLists":
      await client.post("api/lists/refresh");
      break;
  }
  return { success: true };
}
