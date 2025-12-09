import { ServerStatus } from "~/components/dashboard/server-status";
import { QueryTool } from "~/components/dashboard/query-tool";
import { Operations } from "~/components/dashboard/operations";
import { QueryLogs } from "~/components/dashboard/query-logs/query-logs";
import { env } from "~/env";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const showLogs = env.DATABASE_URL ?? env.DEMO_MODE ?? false;

  return (
    <main className="container mx-auto max-w-5xl p-4">
      <h1 className="font-title mt-8 mb-16 text-6xl font-bold">
        {"> "}BlockyUI
      </h1>

      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ServerStatus />
          <Operations />
        </div>
        <QueryTool />
        {Boolean(showLogs) && <QueryLogs />}
      </div>
    </main>
  );
}
