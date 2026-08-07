import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4175";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  reporter: "list",
  use: {
    baseURL,
    colorScheme: "dark",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "python3 -m http.server 4175",
        url: "http://127.0.0.1:4175",
        reuseExistingServer: true,
        timeout: 15_000,
      },
});
