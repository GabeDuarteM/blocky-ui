import { server } from "./server";
import { env } from "../env";

export async function initMocks(): Promise<void> {
  if (env.DEMO_MODE) {
    server.listen();
    console.log("MSW initialized in demo mode");
  }
}
