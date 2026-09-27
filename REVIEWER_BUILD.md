# Firefox reviewer build instructions

This repository is a pnpm workspace. The Firefox extension imports source from `packages/shared`, so the extension-only WXT `*-sources.zip` is incomplete. Submit the `*-review-source.zip` generated from the committed repository with each Firefox version.

## Rebuild the submitted add-on

Build environment: Linux or macOS, Node.js 22.22.3, pnpm 11.9.0. The build uses the open-source WXT, Vite, and Svelte toolchain. No accounts, credentials, or private repositories are needed.

From the root of the extracted reviewer source archive:

```sh
pnpm install --frozen-lockfile
pnpm --filter @acme/extension build:firefox
pnpm --filter @acme/extension zip:firefox
```

The installable archive is `packages/webextension/.output/cardcutter-<version>-firefox.zip`. Compare the unpacked extension files with the submitted add-on. ZIP metadata such as timestamps may differ between builds.

To generate the reviewer source archive from a clean commit:

```sh
pnpm store:review-source
```

The archive includes `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/shared`, `packages/webextension`, and this file. It is distinct from the installable Firefox ZIP.

## Reviewer context

The add-on captures only the page for which the user clicks its toolbar button. Its `activeTab`, `scripting`, `storage`, and `clipboardWrite` permissions support that flow. Metadata extraction is offline: `ztractor@2.0.0` and Zotero translator data are bundled, and the sandbox's `connect-src` is `none`. The sandbox contains generated Zotero runtime code that uses `new Function`; it is isolated from extension APIs. See `packages/webextension/src/entrypoints/sandbox/main.ts` and `packages/webextension/src/lib/extraction.ts`.

Primary third-party source references:

- Ztractor: https://github.com/ThatXliner/ztractor (published package `ztractor@2.0.0`)
- Zotero translators and runtime: https://github.com/zotero/translators and https://github.com/zotero/zotero
- WXT: https://github.com/wxt-dev/wxt
- Svelte: https://github.com/sveltejs/svelte
- Lucide: https://github.com/lucide-icons/lucide

Exact dependency versions are pinned in `pnpm-lock.yaml`. License notices are in `packages/webextension/public`.
