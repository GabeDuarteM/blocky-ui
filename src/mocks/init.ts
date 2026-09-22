import { server } from "./server";

export function initMocks(): Promise<void> {
  server.listen();
  console.log("MSW initialized");

  return Promise.resolve();
}
