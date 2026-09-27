# Card Cutter privacy policy

Last updated: September 26, 2026

Card Cutter formats debate evidence from the page you choose to capture. It runs locally in your browser. We do not operate an account service, analytics service, or server that receives your captured pages or cards.

## Data the extension handles

When you click the toolbar button, Card Cutter reads the active page's URL, title, HTML, visible article text, and any selected text. It uses that snapshot to fill citation fields and start a card. The extension retains up to ten recent page snapshots in its local IndexedDB for the popup-to-editor handoff and later editing. Older snapshots are removed as new ones are saved; the remaining snapshots stay until replaced or the extension's data is cleared.

Edited cards, including citation fields, tag, evidence text, and highlights, are saved in the browser's extension-local storage until you delete the card or clear the extension's data. The last entered code and tag and the line-break setting are saved in the extension's local storage as defaults for new cards. Clicking **Delete saved card** removes that card draft. You can remove all extension data using your browser's extension/data controls or by uninstalling Card Cutter.

## Sharing and transmission

Card Cutter does not send captured page content, cards, or preferences to us or third parties. Citation extraction uses bundled code in a sandbox with network access disabled. Copying a card writes it to your device's clipboard; content you later paste into another app is handled by that app.

## Permissions

- `activeTab` and `scripting` let Card Cutter read the page only after you click its toolbar button.
- `storage` saves card drafts and preferences on your device.
- `clipboardWrite` lets you copy the formatted card.

Card Cutter does not request access to all websites in the background.

For questions or privacy requests, open an issue at https://github.com/ThatXliner/cardcutter/issues.
