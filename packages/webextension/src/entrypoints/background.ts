/**
 * Background script for CardCutter extension
 * Note: Ztractor extraction now happens in content script where DOMParser is available
 */

export default defineBackground(() => {
  console.log("CardCutter background script loaded");

  // Background script can be used for other tasks if needed in the future
  // Ztractor extraction is now handled in the content script
});
