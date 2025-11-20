// import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let injectedScriptLoaded = false;
    const pendingRequests = new Map<string, (response: any) => void>();

    // Inject the ztractor script into page context to bypass CSP
    function injectZtractorScript() {
      if (injectedScriptLoaded) {
        console.log("[Content Script] ℹ️ Script already injected, skipping");
        return;
      }

      const script = document.createElement("script");
      const scriptUrl = browser.runtime.getURL("injected.js");
      script.src = scriptUrl;
      script.type = "module";

      script.onload = () => {
        console.log("[Content Script] ✅ Injected script loaded successfully");
      };

      script.onerror = (error) => {
        console.error("[Content Script] ❌ Failed to load injected script:", error);
      };

      (document.head || document.documentElement).appendChild(script);
      injectedScriptLoaded = true;

      console.log("[Content Script] 💉 Injecting ztractor script into page context");
      console.log("[Content Script] 🔗 Script URL:", scriptUrl);
    }

    // Listen for responses from injected script
    window.addEventListener("message", (event) => {
      console.log("[Content Script] 📨 Received window message:", {
        type: event.data?.type,
        source: event.source === window ? "window" : "other",
        origin: event.origin,
      });

      if (event.source !== window) {
        console.log("[Content Script] ❌ Ignoring message - source is not window");
        return;
      }

      if (event.data.type === "CARDCUTTER_EXTRACT_ZTRACTOR_RESPONSE") {
        const { requestId, success, items, translator, error } = event.data.payload;
        console.log("[Content Script] 📬 Got CARDCUTTER_EXTRACT_ZTRACTOR_RESPONSE for requestId:", requestId);

        const resolver = pendingRequests.get(requestId);
        console.log("[Content Script] Resolver found:", !!resolver);
        console.log("[Content Script] Pending requests:", Array.from(pendingRequests.keys()));

        if (resolver) {
          console.log("[Content Script] 📬 Received response from injected script:", {
            requestId,
            success,
            translator,
            itemCount: items?.length || 0,
            error,
          });

          resolver({
            success,
            items,
            translator,
            error,
          });
          pendingRequests.delete(requestId);
        } else {
          console.error("[Content Script] ❌ No resolver found for requestId:", requestId);
        }
      }
    });

    // Listen for metadata extraction requests from the popup
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "EXTRACT_METADATA") {
        try {
          // Get the current page's HTML and URL
          const html = document.documentElement.outerHTML;
          const url = window.location.href;

          // Send back the HTML and URL for Zotero translation
          // The popup will handle calling translation-server with this data
          sendResponse({
            html,
            url,
          });
        } catch (error) {
          console.error("Content script failed to get page data:", error);
          sendResponse({
            html: document.documentElement.outerHTML,
            url: window.location.href,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        // Return true to indicate async response
        return true;
      }

      if (message.type === "EXTRACT_METADATA_ZTRACTOR") {
        // Inject script if not already injected
        injectZtractorScript();

        // Handle extraction via injected script (runs in page context, no CSP restrictions)
        (async () => {
          try {
            const { url, html } = message.payload;
            const requestId = `${Date.now()}-${Math.random()}`;

            console.log("[Content Script] 🚀 Requesting extraction from injected script");
            console.log("[Content Script] 🔗 URL:", url);
            console.log("[Content Script] 📄 HTML length:", html?.length || 0, "characters");
            console.log("[Content Script] 🆔 Request ID:", requestId);

            // Create promise that will be resolved when injected script responds
            const responsePromise = new Promise((resolve) => {
              pendingRequests.set(requestId, resolve);
            });

            // Send message to injected script via postMessage
            console.log("[Content Script] 📤 Sending message to injected script...");
            window.postMessage(
              {
                type: "CARDCUTTER_EXTRACT_ZTRACTOR",
                payload: { url, html, requestId },
              },
              "*"
            );

            // Wait for response (no timeout - let ztractor handle its own timeout)
            console.log("[Content Script] ⏳ Waiting for response from injected script...");
            const result = await responsePromise;

            console.log("[Content Script] ✅ Sending result back to popup");
            sendResponse(result);
          } catch (error) {
            console.error("[Content Script] Error in ztractor extraction:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error occurred",
            });
          }
        })();

        // Return true to indicate async response
        return true;
      }
    });

    console.log("Card Cutter content script loaded");
  },
});
