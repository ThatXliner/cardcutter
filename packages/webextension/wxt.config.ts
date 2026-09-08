import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

type IndexHtmlTransformContext = { filename: string };

let firefoxBuild = false;

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/module-svelte"],
	vite: (env) => {
		firefoxBuild = env.browser === "firefox";
		return {
			plugins: [
				tailwindcss(),
				...(firefoxBuild ? [{
					name: "firefox-sandbox-classic-script",
					transformIndexHtml: {
						order: "post" as const,
						handler: (html: string, context: IndexHtmlTransformContext) => {
							if (!context.filename.replaceAll("\\", "/").endsWith("/sandbox/index.html")) return html;
							// Firefox gives native sandbox pages an opaque origin. It permits
							// classic extension scripts there but rejects module loads.
							return html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, "<script src=\"$1\"></script>");
						},
					},
				}] : []),
			],
		};
	},
	hooks: {
		"vite:build:extendConfig": (entrypoints, viteConfig) => {
			if (!firefoxBuild || !entrypoints.every((entrypoint) => entrypoint.type === "sandbox")) return;

			viteConfig.build ??= {};
			viteConfig.build.rollupOptions ??= {};
			viteConfig.build.rollupOptions.output = {
				// Keep the Firefox sandbox bundle free of dynamic module imports.
				format: "iife",
				inlineDynamicImports: true,
			};
		},
	},
	manifest: ({ browser }) => ({
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
			default_popup: "popup.html",
		},
		content_security_policy: {
			extension_pages:
				"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'self'; form-action 'none'",
			sandbox:
				"sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'",
		},
		sandbox: {
			pages: ["sandbox.html"],
		},
		...(browser === "firefox" ? {
			browser_specific_settings: {
				gecko: {
					id: "cardcutter@thatxliner",
					strict_min_version: "154.0",
					data_collection_permissions: {
						required: ["none"],
					},
				},
			},
		} : {}),
	}),
	zip: {
		name: "cardcutter",
	},
});
