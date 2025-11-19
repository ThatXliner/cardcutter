// import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
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
    });

    console.log("Card Cutter content script loaded");
  },
});
