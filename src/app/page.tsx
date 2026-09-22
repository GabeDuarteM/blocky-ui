import { ConnectedDashboard } from "~/components/dashboard/connected-dashboard";
import { DEFAULT_DEMO_CONFIGURATION, demoServers } from "~/demo/config";
import { getConfiguration } from "~/server/config";
import { serverSummaries } from "~/server/config/servers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configuration = await getConfiguration();
  const servers = configuration.demoMode
    ? demoServers(DEFAULT_DEMO_CONFIGURATION.serverCount)
    : serverSummaries(configuration);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-bold font-title text-5xl sm:text-6xl">
          {"> "}BlockyUI
        </h1>
      </header>

      <ConnectedDashboard servers={servers} demoMode={configuration.demoMode} />
    </main>
  );
}
