import { mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(resolve(root, 'packages/webextension/package.json'), 'utf8'));
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (revision.status !== 0) throw new Error(revision.stderr || 'Could not read the commit to archive.');
const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
if (dirty.status !== 0 || dirty.stdout.trim()) {
	throw new Error('Commit all store and source changes before packaging reviewer source.');
}

const committedVersion = spawnSync('git', ['show', 'HEAD:packages/webextension/package.json'], { cwd: root, encoding: 'utf8' });
if (committedVersion.status !== 0 || JSON.parse(committedVersion.stdout).version !== packageJson.version) {
	throw new Error('Commit the extension version before packaging reviewer source.');
}

const outputDir = resolve(root, 'packages/webextension/.output');
await mkdir(outputDir, { recursive: true });
const archive = resolve(outputDir, `cardcutter-${packageJson.version}-review-source.zip`);
const result = spawnSync('git', ['archive', '--format=zip', `--output=${archive}`, 'HEAD'], { cwd: root, encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'Could not package reviewer source.');
console.log(`Packaged commit ${revision.stdout.trim()} as ${archive}`);
