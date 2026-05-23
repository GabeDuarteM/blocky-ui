import { ServerStatus } from "~/components/dashboard/server-status";
import { QueryTool } from "~/components/dashboard/query-tool";
import { Operations } from "~/components/dashboard/operations";
import { QueryLogs } from "~/components/dashboard/query-logs/query-logs";
import { StatisticsOverview } from "~/components/dashboard/statistics/statistics-overview";
import { ChartsSection } from "~/components/dashboard/statistics/charts-section";
import { env } from "~/env";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const showLogs = env.QUERY_LOG_TARGET ?? env.DEMO_MODE ?? false;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-title text-5xl font-bold sm:text-6xl">
          {"> "}BlockyUI
        </h1>
      </header>

      <div className="space-y-5 sm:space-y-6">
        <StatisticsOverview />
        <div className="grid gap-6 md:grid-cols-2">
          <ServerStatus />
          <Operations />
        </div>
        {Boolean(showLogs) && <ChartsSection />}
        <QueryTool />
        {Boolean(showLogs) && <QueryLogs />}
      </div>
    </main>
  );
}
