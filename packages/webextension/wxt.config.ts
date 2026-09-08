import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/module-svelte"],
	vite: () => ({ plugins: [tailwindcss()] }),
	manifest: {
		name: "Card Cutter",
		description: "NSDA Debate Card Cutter - Format evidence citations with customizable highlighting",
		permissions: [
			"activeTab",
			"scripting",
			"storage",
			"clipboardWrite"
		],
		action: {
			default_title: "Capture page with Card Cutter",
		},
		content_security_policy: {
			extension_pages:
				"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'self'; form-action 'none'",
			sandbox:
				"sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'",
		},
		sandbox: {
			pages: ["sandbox.html"],
		}
	}
});
