/**
 * Injected script that runs in the page context (not content script context)
 * This is REQUIRED because Zotero translators use eval() internally,
 * which is blocked by Content Security Policy in content scripts
 */

import { extractMetadata } from "ztractor";

export default defineUnlistedScript(() => {
  window.addEventListener("message", async (event) => {
    if (event.data.type === "CARDCUTTER_EXTRACT_ZTRACTOR") {
      const { url, html, requestId } = event.data.payload;

      try {
        // Use ztractor to extract metadata
        // DOMParser is available in page context
        const result = await extractMetadata({
          url,
          html,
          dependencies: { DOMParser },
        });

        if (result.success && result.items && result.items.length > 0) {
          window.postMessage(
            {
              type: "CARDCUTTER_EXTRACT_ZTRACTOR_RESPONSE",
              payload: {
                requestId,
                success: true,
                items: result.items,
                translator: result.translator,
              },
            },
            "*",
          );
        } else {
          window.postMessage(
            {
              type: "CARDCUTTER_EXTRACT_ZTRACTOR_RESPONSE",
              payload: {
                requestId,
                success: false,
                error: result.error || "No metadata could be extracted",
              },
            },
            "*",
          );
        }
      } catch (error) {
        window.postMessage(
          {
            type: "CARDCUTTER_EXTRACT_ZTRACTOR_RESPONSE",
            payload: {
              requestId,
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            },
          },
          "*",
        );
      }
    }
  });
});
