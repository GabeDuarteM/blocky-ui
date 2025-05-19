import { ServerStatus } from "~/components/dashboard/server-status";
import { QueryTool } from "~/components/dashboard/query-tool";
import { Operations } from "~/components/dashboard/operations";

export default function HomePage() {
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
      </div>
    </main>
  );
}
