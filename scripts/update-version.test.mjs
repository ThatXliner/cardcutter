import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { computeNextVersion, updateVersionFile } from "./update-version.mjs";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptsDirectory, "update-version.mjs");
const extensionPackagePath = join(scriptsDirectory, "../packages/webextension/package.json");

test("computes patch, minor, and major bumps", () => {
	assert.equal(computeNextVersion("0.1.0", "patch"), "0.1.1");
	assert.equal(computeNextVersion("0.1.0", "minor"), "0.2.0");
	assert.equal(computeNextVersion("0.1.0", "major"), "1.0.0");
});

test("accepts a greater explicit version", () => {
	assert.equal(computeNextVersion("0.1.0", "0.2.0"), "0.2.0");
	assert.equal(computeNextVersion("1.2.3", "1.2.4"), "1.2.4");
});

test("rejects malformed, prerelease, leading-zero, and overflowing versions", () => {
	for (const requestedVersion of [
		"",
		"1",
		"1.2",
		"1.2.3.4",
		"1.2.3-alpha",
		"01.2.3",
		"-1.2.3",
		"1.2.65536",
	]) {
		assert.throws(
			() => computeNextVersion("0.1.0", requestedVersion),
			/version|Usage/,
			`expected ${requestedVersion} to be rejected`,
		);
	}

	assert.throws(() => computeNextVersion("0.1.65535", "patch"), /exceed/);
	assert.throws(() => computeNextVersion("65535.0.0", "major"), /exceed/);
});

test("rejects an explicit version that is not greater", () => {
	assert.throws(() => computeNextVersion("0.1.0", "0.1.0"), /greater/);
	assert.throws(() => computeNextVersion("0.1.0", "0.0.9"), /greater/);
});

test("mutates only a supplied canonical package fixture", async () => {
	const originalVersion = JSON.parse(await readFile(extensionPackagePath, "utf8")).version;
	const temporaryDirectory = await mkdtemp(join(tmpdir(), "cardcutter-version-test-"));
	const temporaryPackagePath = join(temporaryDirectory, "package.json");
	const originalSource = '{\n  "name": "fixture",\n  "private": true,\n  "version": "0.1.0"\n}\n';

	try {
		await writeFile(temporaryPackagePath, originalSource);
		assert.equal(await updateVersionFile(temporaryPackagePath, "minor"), "0.2.0");
		assert.equal(JSON.parse(await readFile(temporaryPackagePath, "utf8")).version, "0.2.0");

		await assert.rejects(
			() => updateVersionFile(temporaryPackagePath, "0.2.0"),
			/greater/,
		);
		assert.equal(await readFile(temporaryPackagePath, "utf8"), originalSource.replace("0.1.0", "0.2.0"));
		assert.equal(JSON.parse(await readFile(extensionPackagePath, "utf8")).version, originalVersion);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
});

test("CLI requires exactly one update argument", async () => {
	const packageSourceBefore = await readFile(extensionPackagePath, "utf8");
	const result = spawnSync(process.execPath, [scriptPath], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /Usage: pnpm run update/);
	assert.equal(await readFile(extensionPackagePath, "utf8"), packageSourceBefore);
});

test("CLI resolves its canonical package relative to the script", async () => {
	const originalPackageSource = await readFile(extensionPackagePath, "utf8");
	const temporaryDirectory = await mkdtemp(join(tmpdir(), "cardcutter-version-cli-test-"));
	const temporaryScriptPath = join(temporaryDirectory, "scripts", "update-version.mjs");
	const temporaryPackagePath = join(temporaryDirectory, "packages", "webextension", "package.json");

	try {
		await mkdir(dirname(temporaryScriptPath), { recursive: true });
		await mkdir(dirname(temporaryPackagePath), { recursive: true });
		await copyFile(scriptPath, temporaryScriptPath);
		await writeFile(
			temporaryPackagePath,
			'{\n  "name": "fixture",\n  "private": true,\n  "version": "1.2.3"\n}\n',
		);

		const result = spawnSync(process.execPath, [temporaryScriptPath, "patch"], {
			cwd: tmpdir(),
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Updated extension version/);
		assert.equal(
			JSON.parse(await readFile(temporaryPackagePath, "utf8")).version,
			"1.2.4",
		);
		assert.equal(await readFile(extensionPackagePath, "utf8"), originalPackageSource);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
});
