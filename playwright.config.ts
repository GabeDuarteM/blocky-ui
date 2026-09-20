import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const baseURL = "http://127.0.0.1:3101";
const serverPath = fileURLToPath(new URL("./e2e/server.js", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/e2e",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}-{projectName}{ext}",
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  expect: {
    toHaveScreenshot: {
      threshold: 0,
      maxDiffPixels: 0,
      stylePath: fileURLToPath(
        new URL("./e2e/screenshot.css", import.meta.url),
      ),
    },
  },
  use: {
    baseURL,
    channel: "chromium",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--disable-gpu-rasterization"],
    },
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `node "${serverPath}" start --hostname 127.0.0.1 --port 3101`,
    url: baseURL,
    env: {
      DEMO_MODE: "true",
      BLOCKY_UI_CONFIG: "",
      BLOCKY_API_URL: "http://blocky.test",
    },
  },
});
