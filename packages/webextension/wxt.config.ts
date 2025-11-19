import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/module-svelte"],
	vite: (_) => ({
		plugins: [tailwindcss()],
	}),
	manifest: {
		name: "Card Cutter",
		description: "NSDA Debate Card Cutter - Format evidence citations with customizable highlighting",
		permissions: [
			"activeTab",
			"tabs",
			"storage",
			"clipboardWrite"
		],
		host_permissions: [
			"<all_urls>"
		]
	}
});
