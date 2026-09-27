# Store submission material

Current upload version: `0.1.3`. Use a new extension version for any later code change; store review may require fixes.

## Chrome Web Store

Upload `packages/webextension/.output/cardcutter-0.1.3-chrome.zip` from `pnpm --filter @acme/extension zip`. The ZIP has `manifest.json` at its root. The 128-pixel icon is already inside it.

**Name:** Card Cutter

**Short description:** Format debate evidence from the current article with citations and highlighting.

**Detailed description:** Card Cutter captures an article when you click its toolbar button, extracts citation details locally, and opens an editor for your debate card. Edit the citation and evidence, highlight selected passages, and copy the formatted card as rich text. Your draft cards and preferences stay on this device. Citation extraction is an autofill aid; check fields against the source before using a card.

**Category:** Productivity (suggested)

**Single purpose:** Turn a user-selected article into an editable, formatted debate evidence card.

**Permission explanations:** `activeTab` grants access to the current page after a toolbar click; `scripting` captures that page's HTML, text, and selection; `storage` saves drafts and preferences locally; `clipboardWrite` copies the formatted card.

**Data disclosure:** The extension handles website content, URLs, and user-entered card text locally. It does not send these to the developer or a third party. Use the public `PRIVACY.md` URL in the dashboard: https://github.com/ThatXliner/cardcutter/blob/main/PRIVACY.md. Complete the dashboard's data-use questions consistently with this policy.

**Images:** `store-assets/chrome-screenshot-article.png` and `store-assets/chrome-screenshot-card.png` are 1280×800 screenshots of the real extension using a local fixture. `store-assets/chrome-promo.png` is the required 440×280 promotional tile.

**Reviewer test:** Open an ordinary article, optionally select a passage, and click the Card Cutter toolbar icon. Edit the card in the popup or choose **Open in new tab**. No account or external service is needed. The local test fixture is in `packages/webextension/e2e/cardcutter.spec.ts`.

## Firefox Add-ons (AMO)

Choose **On this site** to list the add-on. Upload `packages/webextension/.output/cardcutter-0.1.3-firefox.zip` from `pnpm --filter @acme/extension zip:firefox`, and upload the matching `packages/webextension/.output/cardcutter-0.1.3-review-source.zip` separately as reviewer source. Paste or attach `REVIEWER_BUILD.md` as build and reviewer notes.

The Firefox manifest declares no data transmission (`data_collection_permissions.required: ["none"]`). The extension keeps captures, drafts, and preferences locally as described in `PRIVACY.md`. It currently requires Firefox 154 or newer. A normal Firefox installation requires AMO signing; the GitHub ZIP is for review/builds and temporary developer installs.

## Account steps

The publisher must register/sign in to the Chrome Web Store developer dashboard, pay its registration fee if needed, enable two-step verification, and submit the Chrome listing for review. The publisher must also sign in to AMO, accept its developer terms, and submit the Firefox listing. These account and review steps are not performed by this repository.
