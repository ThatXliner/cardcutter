export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let injectedScriptLoaded = false;
    const pendingRequests = new Map<string, (response: any) => void>();

    // Inject the ztractor script into page context to bypass CSP
    // This is REQUIRED because Zotero translators use eval() internally,
    // which is blocked by Content Security Policy in content scripts
    function injectZtractorScript() {
      if (injectedScriptLoaded) {
        return;
      }

      const script = document.createElement("script");
      script.src = browser.runtime.getURL("injected.js");
      script.type = "module";
      (document.head || document.documentElement).appendChild(script);
      injectedScriptLoaded = true;
    }

    // Listen for responses from injected script
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;

      if (event.data.type === "CARDCUTTER_EXTRACT_ZTRACTOR_RESPONSE") {
        const { requestId, success, items, translator, error } = event.data.payload;
        const resolver = pendingRequests.get(requestId);

        if (resolver) {
          resolver({ success, items, translator, error });
          pendingRequests.delete(requestId);
        }
      }
    });

    // Listen for metadata extraction requests from the popup
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "EXTRACT_METADATA") {
        try {
          const html = document.documentElement.outerHTML;
          const url = window.location.href;
          sendResponse({ html, url });
        } catch (error) {
          console.error("Content script failed to get page data:", error);
          sendResponse({
            html: document.documentElement.outerHTML,
            url: window.location.href,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
        return true;
      }

      if (message.type === "EXTRACT_METADATA_ZTRACTOR") {
        injectZtractorScript();

        (async () => {
          try {
            const { url, html } = message.payload;
            const requestId = `${Date.now()}-${Math.random()}`;

            const responsePromise = new Promise((resolve) => {
              pendingRequests.set(requestId, resolve);
            });

            window.postMessage(
              {
                type: "CARDCUTTER_EXTRACT_ZTRACTOR",
                payload: { url, html, requestId },
              },
              "*"
            );

            const result = await responsePromise;
            sendResponse(result);
          } catch (error) {
            console.error("[Content Script] Error in ztractor extraction:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error occurred",
            });
          }
        })();

        return true;
      }
    });

    console.log("Card Cutter content script loaded");
  },
});
