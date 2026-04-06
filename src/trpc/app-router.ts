// Re-export the router type through a local module so client code can reference it
// without creating a runtime import edge to the server router on turbopack.
//
// Fixes the issue of opening any page and getting a runtime error.
export type { AppRouter } from "~/server/api/root";
