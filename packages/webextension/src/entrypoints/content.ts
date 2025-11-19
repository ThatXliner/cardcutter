import { extractMetadataFromHtml } from '@acme/shared/utils/metadataExtractor';

export default defineContentScript({
	matches: ['<all_urls>'],
	main() {
		// Listen for metadata extraction requests from the popup
		browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if (message.type === 'EXTRACT_METADATA') {
				try {
					// Get the current page's HTML
					const html = document.documentElement.outerHTML;
					const url = window.location.href;

					// Extract metadata using the shared utility
					const metadata = extractMetadataFromHtml(html, url);

					// Send back the metadata and HTML (for potential AI extraction)
					sendResponse({
						metadata,
						html
					});
				} catch (error) {
					console.error('Content script metadata extraction failed:', error);
					sendResponse({
						metadata: {
							title: document.title || '',
							author: '',
							qualifications: '',
							publisher: '',
							date: '',
							description: ''
						},
						html: document.documentElement.outerHTML
					});
				}

				// Return true to indicate async response
				return true;
			}
		});

		console.log('Card Cutter content script loaded');
	}
});
