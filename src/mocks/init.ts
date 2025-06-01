import { server } from "./server";

export async function initMocks(): Promise<void> {
  server.listen();
  console.log("MSW initialized");
}
