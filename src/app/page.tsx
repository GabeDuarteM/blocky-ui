import { Dashboard } from "~/components/dashboard/dashboard";
import { env } from "~/env";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const showLogs = Boolean(env.QUERY_LOG_TARGET ?? env.DEMO_MODE);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-title text-5xl font-bold sm:text-6xl">
          {"> "}BlockyUI
        </h1>
      </header>

      <Dashboard showLogs={showLogs} />
    </main>
  );
}
