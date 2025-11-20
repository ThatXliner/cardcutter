/**
 * Background script for CardCutter extension
 * Handles metadata extraction using ztractor
 */

import { extractMetadata } from 'ztractor';

export default defineBackground(() => {
	console.log('CardCutter background script loaded');

	// Listen for messages from popup/content scripts
	browser.runtime.onMessage.addListener(async (message, sender) => {
		if (message.type === 'EXTRACT_METADATA_ZTRACTOR') {
			try {
				const { url, html } = message.payload;

				console.log('Extracting metadata for:', url);

				// Use ztractor to extract metadata
				const result = await extractMetadata({
					url,
					html,
					timeout: 15000, // 15 second timeout
				});

				if (result.success && result.items && result.items.length > 0) {
					console.log('Successfully extracted metadata using ztractor');
					return {
						success: true,
						items: result.items,
						translator: result.translator,
					};
				} else {
					console.warn('Ztractor extraction failed:', result.error);
					return {
						success: false,
						error: result.error || 'No metadata could be extracted',
					};
				}
			} catch (error) {
				console.error('Error in ztractor extraction:', error);
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error occurred',
				};
			}
		}
	});
});
