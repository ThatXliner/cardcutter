# Card Cutter

Card Cutter is a local-first Chrome extension for making NSDA-style debate
evidence cards from the page currently open in your browser. Click the toolbar
button to capture the page, review its citation and text in the editor, then
copy a rich-text card into Google Docs or another editor.

The extension is the supported product in this repository. It reuses the
original Card Cutter form, citation controls, card preview, and configurable
highlight levels from `packages/shared`. `packages/old-frontend` is historical
and is not the canonical interface.

## Privacy and limits

Card Cutter does not use AI and does not send background network requests. It
captures the active `http` or `https` page after a toolbar click, stores a
temporary page snapshot in browser session storage, and saves your editable
cards in browser local storage. Metadata extraction uses the bundled Zotero
translator runtime against that cached HTML with network access denied.
Browser storage has a finite quota; if a card cannot be saved, copy it and
delete unused saved cards to free space.

The page-only model has limits. Translators that need a follow-up network
request can fail. Embedded Metadata is available as a local fallback when the
page exposes compatible metadata, but missing fields are left blank for review;
they are not guaranteed to be found. The extension does not claim support for
every website.

## Build from sibling checkouts

The extension consumes the local `ztractor` package at `../ztractor`, so clone
both repositories beside one another:

```sh
git clone https://github.com/ThatXliner/cardcutter.git
git clone --recurse-submodules https://github.com/ThatXliner/ztractor.git

cd ztractor
git submodule update --init --recursive
bun install
bun run build

cd ../cardcutter
pnpm install
pnpm extension:check
pnpm extension:test
pnpm extension:build
```

This build was verified with Node v22.22.3 and pnpm 11.9.0. Rebuild `ztractor`
before reinstalling Card Cutter whenever its local package changes.

## Install the extension

For an unpacked Chrome build, run `pnpm extension:build`, open
`chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**,
and select `packages/webextension/.output/chrome-mv3`.

To create a zip, run:

```sh
pnpm --filter @acme/extension zip
```

The generated archive is intended for manual distribution or inspection. This
repository does not make claims about browser-store availability or approval.

## Verify the extension

Install Chromium for Playwright once with `pnpm --filter @acme/extension exec
playwright install chromium`, then run `pnpm --filter @acme/extension test:e2e`.
The end-to-end suite loads the unpacked MV3 build and exercises the original
Card Cutter controls against local fixtures.

## License and notices

Card Cutter bundles [ztractor](https://github.com/ThatXliner/ztractor), which
uses the Zotero translation runtime and translators. The full AGPL v3 license
is in [LICENSE](./LICENSE); shipped extension builds also include `LICENSE`,
`THIRD_PARTY_NOTICES.md`, and `ZOTERO_COPYING` from the public extension assets.
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for attribution details.
