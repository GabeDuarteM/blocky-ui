import { env } from "~/env";
import { demoServers, DEFAULT_DEMO_CONFIGURATION } from "~/demo/config";
import { ConnectedDashboard } from "~/components/dashboard/connected-dashboard";
import { serverSummaries } from "~/server/config/servers";
import { getConfiguration } from "~/server/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const servers = env.DEMO_MODE
    ? demoServers(DEFAULT_DEMO_CONFIGURATION.serverCount)
    : serverSummaries(await getConfiguration());

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-title text-5xl font-bold sm:text-6xl">
          {"> "}BlockyUI
        </h1>
      </header>

      <ConnectedDashboard servers={servers} demoMode={env.DEMO_MODE} />
    </main>
  );
}
