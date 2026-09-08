# Card Cutter

Card Cutter turns the article you're reading into an NSDA-style debate evidence
card. It runs as a Chrome and Firefox extension.

Use it like this:

1. Open an article and, if useful, select the passage you want to quote.
2. Click the Card Cutter button in the browser toolbar. The popup captures the
   page and autofills citation fields from the captured HTML.
3. Review and edit the citation and text. Apply highlight levels and add a tag
   as needed.
4. Copy the rich text and paste the card into Google Docs or another editor.

The toolbar popup closes when you click outside it, as browser action popups
normally do. Choose **Open in new tab** to keep working in a full browser tab.
It opens the same saved draft, including edits already made in the popup. Saved
cards are available locally from the editor.

## Web version

The original web editor remains usable in `packages/old-frontend`, although the
browser extension is recommended for capturing citations from the page you are
reading. Its deployed build uses the separately published legacy `ztractor`
package, can fetch page HTML over the network, and optionally supports
bring-your-own-key (BYOK) AI metadata extraction. The extension uses its pinned
local extractor and does not use AI or make background requests to publishers.

Run the web editor locally with:

```sh
pnpm install --frozen-lockfile --filter @acme/old-frontend
pnpm --filter @acme/old-frontend dev
pnpm --filter @acme/old-frontend build
```

## Privacy and limits

The extension uses the local [Ztractor](https://github.com/ThatXliner/ztractor)
checkout's pinned Zotero translation runtime and bundled web translators. It
does not use AI or make background
requests to publishers. A toolbar capture reads the active `http` or `https`
page and stores its HTML, text, and optional selection in browser session
storage. Card drafts are saved in browser local storage.

Metadata extraction runs against the captured HTML with `network: 'deny'`, so
Ztractor blocks translator follow-up requests. Metadata is an autofill aid, not
source verification. Translators can return wrong or incomplete fields, and
missing fields stay blank. Review citation fields against the article before
copying. Some sites require runtime features or network access, so universal
site coverage is not promised.

## Install the latest release

Open the [latest GitHub release](https://github.com/ThatXliner/cardcutter/releases/latest)
and download the Chrome or Firefox archive: `cardcutter-<version>-chrome.zip`
or `cardcutter-<version>-firefox.zip`. GitHub's automatically generated Source
code ZIPs are source archives and do not contain the built extension.

### Chrome

Unzip the Chrome archive and find the folder containing `manifest.json`. Open
`chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and
select that folder.

### Firefox 154+

Unzip the Firefox archive and open `about:debugging#/runtime/this-firefox`.
Choose **Load Temporary Add-on** and select its `manifest.json`. Firefox removes
unsigned temporary add-ons when it restarts; a permanent installation requires
Mozilla signing. A release install needs no source checkout or build tools.

## Build from source

Card Cutter consumes `../ztractor` as a local package. For the same toolchain
used by CI, use Node v22.22.3, pnpm 11.9.0, and Bun 1.3.14.

Clone both repositories beside one another, build Ztractor first, then build
the extension:

```sh
git clone https://github.com/ThatXliner/cardcutter.git
git clone --recurse-submodules https://github.com/ThatXliner/ztractor.git

cd ztractor
git submodule update --init --recursive
bun install
bun run build

cd ../cardcutter
pnpm install
pnpm extension:build
```

After changing the sibling checkout, rebuild Ztractor and run `pnpm install`
in Card Cutter again. CI checks out a pinned Ztractor revision and builds that
checkout before installing the extension.

## Install a local build

### Chrome

Run `pnpm extension:build`, open `chrome://extensions`, turn on **Developer
mode**, choose **Load unpacked**, and select:

```
packages/webextension/.output/chrome-mv3
```

The toolbar button opens the current capture popup. Load this artifact locally
using the steps above.

### Firefox 154+

Build the Firefox Manifest V3 artifact:

```sh
pnpm --filter @acme/extension build:firefox
```

Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary
Add-on**, and select:

```
packages/webextension/.output/firefox-mv3/manifest.json
```

Firefox removes unsigned temporary add-ons when it restarts. A permanent
installation requires Mozilla signing.

## Create ZIPs

From the Card Cutter repository root, create the Chrome and Firefox archives
with the package scripts:

```sh
pnpm --filter @acme/extension zip
# packages/webextension/.output/cardcutter-<version>-chrome.zip

pnpm --filter @acme/extension zip:firefox
# packages/webextension/.output/cardcutter-<version>-firefox.zip
```

These archives are for local inspection or manual distribution.

## Version and release (maintainers)

The canonical extension version is in `packages/webextension/package.json`.
Update it with one argument:

```sh
# Choose one:
pnpm run update patch
# pnpm run update minor
# pnpm run update major
# pnpm run update 0.2.0
```

The script changes only the extension package version; it does not commit, tag,
or publish, and it leaves dependencies and lockfiles unchanged.

Commit and merge the version bump on `main`, then publish a GitHub release with
a tag of `vVERSION` that matches the extension package version. The [release
workflow](https://github.com/ThatXliner/cardcutter/actions/workflows/ci.yml)
builds and tests the extension, uploads the Chrome and Firefox ZIPs, and fails
before the build if the release tag does not match. For example:

```sh
gh release create v0.2.0 --target main --title "Card Cutter v0.2.0" --generate-notes
```

## Develop and verify

The root scripts delegate checks to the maintained extension package:

```sh
pnpm extension:check
pnpm extension:test
pnpm --filter @acme/extension test:manifest
```

`test:manifest` builds both Chrome and Firefox artifacts and checks their
manifests. The end-to-end suite needs the built Chrome directory and a
Playwright Chromium installation:

```sh
pnpm extension:build
pnpm --filter @acme/extension exec playwright install chromium
pnpm --filter @acme/extension test:e2e
```

For the native Firefox smoke test and the WXT development sandbox limitation,
see the [webextension README](./packages/webextension/README.md). Native
Firefox testing uses `build:firefox`; the WXT dev server's ESM sandbox is not
the supported Firefox test path.

## Repository map

- `packages/shared`: original Svelte Card Cutter UI components and shared types.
- `packages/webextension`: the maintained browser-extension product.
- `packages/old-frontend`: maintained deprecated web editor.

## License and notices

Card Cutter is licensed under AGPL v3+, available in [LICENSE](./LICENSE). The
extension bundles Ztractor, the Zotero translation runtime, and translators.
Shipped builds include [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and
`ZOTERO_COPYING`; see those files for attribution details.
