import { ServerStatus } from "~/components/dashboard/server-status";
import { QueryTool } from "~/components/dashboard/query-tool";
import { Operations } from "~/components/dashboard/operations";

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-3xl p-4">
      <h1 className="mb-8 text-4xl font-bold">Blocky UI</h1>

      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ServerStatus />
          <Operations />
        </div>
        <QueryTool />
      </div>
    </main>
  );
}
