import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const output = join(process.cwd(), ".output");

async function readManifest(browser) {
	return JSON.parse(await readFile(join(output, `${browser}-mv3`, "manifest.json"), "utf8"));
}

const [chrome, firefox, chromeSandbox, firefoxSandbox] = await Promise.all([
	readManifest("chrome"),
	readManifest("firefox"),
	readFile(join(output, "chrome-mv3", "sandbox.html"), "utf8"),
	readFile(join(output, "firefox-mv3", "sandbox.html"), "utf8"),
]);

for (const manifest of [chrome, firefox]) {
	assert.equal(manifest.manifest_version, 3);
	assert.equal(manifest.action.default_popup, "popup.html");
	assert.deepEqual(manifest.sandbox, { pages: ["sandbox.html"] });
	assert.equal(
		manifest.content_security_policy.sandbox,
		"sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'",
	);
	assert.equal(
		manifest.content_security_policy.extension_pages,
		"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'self'; form-action 'none'",
	);
	assert.equal(manifest.host_permissions, undefined);
}

assert.equal(chrome.browser_specific_settings, undefined);
assert.deepEqual(firefox.browser_specific_settings, {
	gecko: {
		id: "cardcutter@thatxliner",
		strict_min_version: "154.0",
		data_collection_permissions: {
			required: ["none"],
		},
	},
});
assert.match(chromeSandbox, /<script type="module" crossorigin src="\/chunks\/sandbox-[^"]+\.js"><\/script>/);
const firefoxSandboxScript = firefoxSandbox.match(/<script src="\/(assets\/sandbox-[^"]+\.js)"><\/script>/);
assert.ok(firefoxSandboxScript, "Firefox sandbox must load one external classic script.");
assert.doesNotMatch(firefoxSandbox, /type="module"|crossorigin/);
assert.doesNotMatch(await readFile(join(output, "firefox-mv3", firefoxSandboxScript[1]), "utf8"), /import\(/);

console.log("Chrome and Firefox MV3 artifacts match the expected isolation and Firefox metadata.");
