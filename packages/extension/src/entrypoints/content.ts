import type { ExtractedMetadata, ExtensionMessage, PageData } from '../lib/types';

export default defineContentScript({
	matches: ['<all_urls>'],
	main() {
		// Listen for messages from popup/background
		browser.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
			if (message.type === 'GET_PAGE_DATA') {
				const pageData = extractPageData();
				sendResponse(pageData);
			}
			return true; // Keep channel open for async response
		});
	}
});

function extractPageData(): PageData {
	const url = window.location.href;
	const selectedText = window.getSelection()?.toString() || '';
	const metadata = extractMetadata();

	return {
		url,
		selectedText,
		metadata
	};
}

function extractMetadata(): ExtractedMetadata {
	// Helper function to get meta tag content
	const getMeta = (selectors: string[]): string | null => {
		for (const selector of selectors) {
			// Try property attribute (Open Graph)
			let el = document.querySelector<HTMLMetaElement>(`meta[property="${selector}"]`);
			if (el?.content) return el.content;

			// Try name attribute
			el = document.querySelector<HTMLMetaElement>(`meta[name="${selector}"]`);
			if (el?.content) return el.content;
		}
		return null;
	};

	// Extract title
	const title =
		getMeta(['og:title', 'twitter:title', 'dc.title']) ||
		document.title ||
		'';

	// Extract author
	let author =
		getMeta([
			'author',
			'article:author',
			'og:article:author',
			'twitter:creator',
			'dc.creator',
			'parsely-author'
		]) || '';

	// Try to find author in byline elements if not in meta tags
	if (!author) {
		const bylineSelectors = [
			'[class*="author"]',
			'[class*="byline"]',
			'[rel="author"]',
			'[itemprop="author"]'
		];

		for (const selector of bylineSelectors) {
			const el = document.querySelector(selector);
			if (el?.textContent) {
				author = el.textContent.trim();
				break;
			}
		}
	}

	// Clean author name
	if (author) {
		author = author
			.replace(/^by\s+/i, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	// Extract publisher
	const publisher =
		getMeta([
			'og:site_name',
			'publisher',
			'application-name',
			'twitter:site',
			'dc.publisher'
		])?.replace('@', '') ||
		window.location.hostname.replace('www.', '');

	// Extract date
	let date =
		getMeta([
			'article:published_time',
			'datePublished',
			'publishdate',
			'date',
			'DC.date.issued',
			'article:published'
		]) || '';

	// Try to find date in time elements if not in meta tags
	if (!date) {
		const timeEl = document.querySelector('time[datetime]');
		if (timeEl) {
			date = timeEl.getAttribute('datetime') || '';
		}
	}

	// Format date if present
	if (date) {
		date = formatDate(date);
	}

	return {
		title,
		author,
		publisher,
		date,
		aiExtracted: false
	};
}

function formatDate(dateString: string): string {
	try {
		// Try parsing as ISO date
		if (dateString.includes('T') || dateString.includes('-')) {
			const date = new Date(dateString);
			if (!isNaN(date.getTime())) {
				return date.toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long'
				});
			}
		}

		// Return original if we can't parse it
		return dateString.trim();
	} catch {
		return dateString.trim();
	}
}
