import { BlockingStatus } from "~/components/dashboard/blocking-status";
import { BlockingControls } from "~/components/dashboard/blocking-controls";
import { QueryTool } from "~/components/dashboard/query-tool";
import { CacheControls } from "~/components/dashboard/cache-controls";
import { ListControls } from "~/components/dashboard/list-controls";

export default function HomePage() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="mb-8 text-4xl font-bold">Blocky Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <BlockingStatus />
          <BlockingControls />
        </div>

        <div className="space-y-6">
          <QueryTool />
          <CacheControls />
          <ListControls />
        </div>
      </div>
    </main>
  );
}
