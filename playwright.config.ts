import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:8787", trace: "retain-on-failure" },
  webServer: { command: "npm start", url: "http://127.0.0.1:8787/api/health", reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
