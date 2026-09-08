import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 20_000 },
	reporter: [["list"], ["html", { outputFolder: "test-results/report", open: "never" }]],
	outputDir: "test-results/artifacts",
	use: {
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
});
