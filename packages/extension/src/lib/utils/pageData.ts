import type { PageData, ExtensionMessage } from '../types';

/**
 * Request page data from the active tab's content script.
 * This includes URL, selected text, and extracted metadata.
 */
export async function getPageData(): Promise<PageData> {
	try {
		const message: ExtensionMessage = { type: 'GET_PAGE_DATA' };
		const response = await browser.runtime.sendMessage(message);
		return response as PageData;
	} catch (error) {
		console.error('Failed to get page data:', error);
		// Return empty data as fallback
		return {
			url: '',
			selectedText: '',
			metadata: {
				aiExtracted: false
			}
		};
	}
}
