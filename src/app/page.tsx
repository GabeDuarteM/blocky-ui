import { BlockingStatus } from "~/components/dashboard/blocking-status";
import { QueryTool } from "~/components/dashboard/query-tool";
import { AdvancedControls } from "~/components/dashboard/advanced-controls";

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-3xl p-4">
      <h1 className="mb-8 text-4xl font-bold">Blocky UI</h1>

      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <BlockingStatus />
          <AdvancedControls />
        </div>
        <QueryTool />
      </div>
    </main>
  );
}
