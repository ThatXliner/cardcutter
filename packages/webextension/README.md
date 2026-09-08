# Card Cutter extension

## Build

Build Chrome with `pnpm build`, or Firefox Manifest V3 with `pnpm build:firefox`.
Create the Firefox package with `pnpm zip:firefox`. The result is
`.output/cardcutter-<version>-firefox.zip`.

## Install the latest release

Download the Chrome or Firefox archive from the [latest GitHub
release](https://github.com/ThatXliner/cardcutter/releases/latest):
`cardcutter-<version>-chrome.zip` or `cardcutter-<version>-firefox.zip`.
Unzip it and follow the browser installation steps in the root
[README](../../README.md). GitHub's Source code ZIPs are not built extension
packages.

The browser action opens a 780 × 600 capture popup. It captures the active
current-window page and opens the existing Card Cutter editor inline; choose
**Open in new tab** at the top of the editor to continue in a full browser tab.

## Temporary Firefox installation

1. Build the Firefox extension: `pnpm build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose
   `.output/firefox-mv3/manifest.json` (or the Firefox ZIP where Firefox accepts it).

Temporary add-ons are removed when Firefox restarts. A permanent installation requires Mozilla
signing.

## Firefox smoke test

With Selenium installed and Firefox 154+ plus geckodriver available, build Firefox and run:

```sh
FIREFOX_BINARY=/path/to/firefox GECKODRIVER=/path/to/geckodriver pnpm test:firefox:smoke
```

The smoke test uses a temporary add-on and disposable profile to click the browser action, capture
a local fixture, and verify sandboxed metadata extraction.

WXT's Firefox development server emits a module sandbox script, which Firefox rejects for native
opaque-origin sandboxes. Test Firefox from `pnpm build:firefox` with a temporary add-on instead.
