/**
 * Injected script that runs in the page context (not content script context)
 * This bypasses CSP restrictions on eval/Function which Zotero translators need
 */

import { extractMetadata } from "ztractor";

export default defineUnlistedScript(() => {
  // Listen for extraction requests from content script
  window.addEventListener("message", async (event) => {
    if (event.data.type === "CARDCUTTER_EXTRACT_ZTRACTOR") {
      const { url, html, requestId } = event.data.payload;

      try {
        console.log(
          "[Injected Script] 🔍 Starting metadata extraction for:",
          url,
        );
        console.log(
          "[Injected Script] 📄 HTML length:",
          html?.length || 0,
          "characters",
        );

        // Use ztractor to extract metadata
        // DOMParser is available in page context
        console.log("[Injected Script] 🔧 Calling ztractor extractMetadata...");
        const result = await extractMetadata({
          url,
          html,
          dependencies: { DOMParser },
        });

        console.log("[Injected Script] 📊 Ztractor result:", {
          success: result.success,
          itemCount: result.items?.length || 0,
          translator: result.translator,
          error: result.error,
        });

        if (result.success && result.items && result.items.length > 0) {
          console.log(
            "[Injected Script] ✅ Successfully extracted metadata using translator:",
            result.translator,
          );
          console.log("[Injected Script] 📝 Extracted items:", result.items);

          // Log item details
          result.items.forEach((item, index) => {
            console.log(`[Injected Script] Item ${index + 1}:`, {
              type: item.itemType,
              title: item.title,
              creators: item.creators,
              date: item.date,
              url: item.url,
            });
          });

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
          console.warn("[Injected Script] ❌ Extraction failed:", result.error);
          console.warn(
            "[Injected Script] No suitable translator found for this page",
          );
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
        console.error("[Injected Script] Error in extraction:", error);
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

  console.log("[Injected Script] CardCutter ztractor injected script loaded");
});
