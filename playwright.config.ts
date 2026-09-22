import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3101";
const serverPath = fileURLToPath(new URL("./e2e/server.js", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/e2e",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}-{projectName}{ext}",
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
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
      args: [
        "--use-angle=swiftshader",
        "--disable-gpu-rasterization",
        "--run-all-compositor-stages-before-draw",
        "--disable-partial-raster",
      ],
    },
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "dashboard-chromium",
      testMatch: "dashboard.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "dashboard-mobile-chromium",
      testMatch: "dashboard.spec.ts",
      dependencies: ["dashboard-chromium"],
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "chromium",
      testIgnore: "dashboard.spec.ts",
      dependencies: ["dashboard-mobile-chromium"],
      fullyParallel: true,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testIgnore: "dashboard.spec.ts",
      dependencies: ["dashboard-mobile-chromium"],
      fullyParallel: true,
      use: { ...devices["Pixel 7"] },
    },
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
