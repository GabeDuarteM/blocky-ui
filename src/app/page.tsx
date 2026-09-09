import { ConnectedDashboard } from "~/components/dashboard/connected-dashboard";
import { serverSummaries } from "~/server/config/servers";
import { getConfiguration } from "~/server/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const servers = serverSummaries(await getConfiguration());

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-title text-5xl font-bold sm:text-6xl">
          {"> "}BlockyUI
        </h1>
      </header>

      <ConnectedDashboard servers={servers} />
    </main>
  );
}
