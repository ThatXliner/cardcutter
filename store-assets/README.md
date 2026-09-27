# Chrome Web Store listing images

The PNGs in this directory are submission assets, not extension runtime files.

The new mark is a cut `C`, designed to stay legible at toolbar size. The extension interface otherwise keeps its existing design.

- `chrome-promo.png`: 440×280 promotional tile. Regenerate with `pnpm --filter @acme/extension store:promo` from the repository root. This uses installed Chrome; set `CHROMIUM_PATH` to another Chromium executable if needed.
- `chrome-screenshot-article.png` and `chrome-screenshot-card.png`: 1280×800 screenshots from the real extension against a local article fixture. Rebuild the Chrome extension, then run `CAPTURE_STORE_ASSETS=1 pnpm --filter @acme/extension exec playwright test --grep 'captures a selected article'`.

Review the images after regeneration before uploading them to a store.
