import type { ExtensionMessage, PageData } from '../lib/types';

export default defineBackground(() => {
	console.log('NSDA Card Cutter background script loaded', { id: browser.runtime.id });

	// Handle messages from popup
	browser.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
		if (message.type === 'GET_PAGE_DATA') {
			// Forward the message to the active tab's content script
			browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
				if (tabs[0]?.id) {
					browser.tabs
						.sendMessage(tabs[0].id, message)
						.then((response: PageData) => {
							sendResponse(response);
						})
						.catch((error) => {
							console.error('Failed to get page data:', error);
							sendResponse({
								url: tabs[0].url || '',
								selectedText: '',
								metadata: {
									aiExtracted: false
								}
							});
						});
				} else {
					sendResponse({
						url: '',
						selectedText: '',
						metadata: {
							aiExtracted: false
						}
					});
				}
			});
			return true; // Keep channel open for async response
		}
	});
});
