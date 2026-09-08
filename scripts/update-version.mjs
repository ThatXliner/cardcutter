import { readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_VERSION_COMPONENT = 65535;
const SIMPLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EXTENSION_PACKAGE_PATH = fileURLToPath(
	new URL("../packages/webextension/package.json", import.meta.url),
);

function parseVersion(version, label) {
	if (typeof version !== "string" || !SIMPLE_VERSION.test(version)) {
		throw new Error(
			`${label} must use the form X.Y.Z with no leading zeroes or prerelease suffix: ${String(version)}`,
		);
	}

	const components = version.split(".").map(Number);
	if (
		components.some(
			(component) =>
				!Number.isSafeInteger(component) || component < 0 || component > MAX_VERSION_COMPONENT,
		)
	) {
		throw new Error(
			`${label} components must be integers from 0 through ${MAX_VERSION_COMPONENT}: ${version}`,
		);
	}

	return components;
}

function compareVersions(left, right) {
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return left[index] - right[index];
	}
	return 0;
}

function formatVersion(components) {
	return components.join(".");
}

export function computeNextVersion(currentVersion, requestedVersion) {
	const current = parseVersion(currentVersion, "Current version");
	if (typeof requestedVersion !== "string" || requestedVersion.length === 0) {
		throw new Error("Usage: pnpm run update <patch|minor|major|X.Y.Z>");
	}

	let next;
	if (requestedVersion === "patch") {
		next = [current[0], current[1], current[2] + 1];
	} else if (requestedVersion === "minor") {
		next = [current[0], current[1] + 1, 0];
	} else if (requestedVersion === "major") {
		next = [current[0] + 1, 0, 0];
	} else {
		next = parseVersion(requestedVersion, "Requested version");
	}

	if (
		next.some(
		(component) =>
				!Number.isSafeInteger(component) || component < 0 || component > MAX_VERSION_COMPONENT,
		)
	) {
		throw new Error(
			`Cannot bump ${currentVersion} with ${requestedVersion}: a version component would exceed ${MAX_VERSION_COMPONENT}`,
		);
	}

	if (compareVersions(next, current) <= 0) {
		throw new Error(
			`Requested version ${formatVersion(next)} must be greater than current version ${currentVersion}`,
		);
	}

	return formatVersion(next);
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function updateVersionFile(packagePath, requestedVersion) {
	const source = await readFile(packagePath, "utf8");
	const packageJson = JSON.parse(source);
	const currentVersion = packageJson.version;
	const nextVersion = computeNextVersion(currentVersion, requestedVersion);
	const versionPattern = new RegExp(
		`(^[\\t ]*"version"[\\t ]*:[\\t ]*")${escapeRegExp(currentVersion)}(")`,
		"m",
	);

	if (!versionPattern.test(source)) {
		throw new Error(`Could not locate the canonical version field in ${packagePath}`);
	}

	const updatedSource = source.replace(
		versionPattern,
		(_match, prefix, suffix) => `${prefix}${nextVersion}${suffix}`,
	);
	if (JSON.parse(updatedSource).version !== nextVersion) {
		throw new Error(`Could not update the canonical version field in ${packagePath}`);
	}
	await writeFile(packagePath, updatedSource);
	return nextVersion;
}

export async function main(argv = process.argv.slice(2), packagePath = EXTENSION_PACKAGE_PATH) {
	if (argv.length !== 1) {
		throw new Error("Usage: pnpm run update <patch|minor|major|X.Y.Z>");
	}

	const nextVersion = await updateVersionFile(packagePath, argv[0]);
	console.log(`Updated extension version to ${nextVersion}.`);
	return nextVersion;
}

const invokedScript = process.argv[1] ? realpathSync(resolve(process.argv[1])) : null;
if (invokedScript === realpathSync(fileURLToPath(import.meta.url))) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
