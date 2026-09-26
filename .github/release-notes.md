## What's new in v0.1.2

- Page captures use extension IndexedDB, avoiding the session-storage quota error on large articles.
- The last entered code and tag are saved as defaults for new cards.
- A saved option collapses evidence line breaks in the preview and copied card while preserving the editable source text.

## Install

Download the ZIP for your browser from **Assets**, then extract it. The automatically generated **Source code** archives are not installable extension builds.

- **Chrome:** open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select the extracted folder containing `manifest.json`.
- **Firefox 154+:** open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on, and select the extracted `manifest.json`. This unsigned installation is removed when Firefox restarts; permanent installation requires Mozilla signing.
