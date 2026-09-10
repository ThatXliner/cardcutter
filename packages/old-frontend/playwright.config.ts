import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: { baseURL: 'http://localhost:4187' },
	webServer: {
		command: 'npm run build && npm run preview -- --port 4187',
		port: 4187
	},
	testDir: 'e2e'
});
