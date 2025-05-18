import { BlockingStatus } from "~/components/dashboard/blocking-status";
import { QueryTool } from "~/components/dashboard/query-tool";

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-3xl p-4">
      <h1 className="mb-8 text-4xl font-bold">Blocky UI</h1>

      <div className="space-y-6">
        <BlockingStatus />
        <QueryTool />
      </div>
    </main>
  );
}
