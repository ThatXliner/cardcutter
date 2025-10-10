export interface ExtractedMetadata {
	title?: string;
	author?: string;
	publisher?: string;
	date?: string;
	description?: string;
}

const CORS_PROXIES = [
	'https://api.allorigins.win/raw?url=',
	'https://corsproxy.io/?',
	'https://api.codetabs.com/v1/proxy?quest='
];

export async function extractMetadata(url: string): Promise<ExtractedMetadata> {
	// Try direct fetch first, then fall back to CORS proxies
	let html: string | null = null;
	let lastError: Error | null = null;

	// Try direct fetch
	try {
		const response = await fetch(url);
		if (response.ok) {
			html = await response.text();
		}
	} catch (error) {
		lastError = error as Error;
	}

	// If direct fetch failed, try CORS proxies
	if (!html) {
		for (const proxy of CORS_PROXIES) {
			try {
				const proxyUrl = proxy + encodeURIComponent(url);
				const response = await fetch(proxyUrl, {
					headers: {
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
					}
				});
				if (response.ok) {
					html = await response.text();
					break;
				}
			} catch (error) {
				lastError = error as Error;
				continue;
			}
		}
	}

	if (!html) {
		console.error('Failed to fetch URL:', lastError);
		// Return basic metadata from URL
		return {
			publisher: new URL(url).hostname.replace('www.', '')
		};
	}

	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		const metadata: ExtractedMetadata = {};

		// Extract title
		metadata.title =
			getMetaContent(doc, 'og:title') ||
			getMetaContent(doc, 'twitter:title') ||
			getMetaContent(doc, 'dc.title') ||
			doc.querySelector('title')?.textContent?.trim() ||
			'';

		// Extract author - try multiple selectors
		metadata.author =
			getMetaContent(doc, 'author') ||
			getMetaContent(doc, 'article:author') ||
			getMetaContent(doc, 'og:article:author') ||
			getMetaContent(doc, 'twitter:creator') ||
			getMetaContent(doc, 'dc.creator') ||
			getMetaContent(doc, 'parsely-author') ||
			doc.querySelector('[rel="author"]')?.textContent?.trim() ||
			doc.querySelector('[itemprop="author"]')?.textContent?.trim() ||
			doc.querySelector('.author')?.textContent?.trim() ||
			doc.querySelector('.byline')?.textContent?.trim() ||
			'';

		// Clean author name - remove "By", extra whitespace
		if (metadata.author) {
			metadata.author = metadata.author
				.replace(/^by\s+/i, '')
				.replace(/\s+/g, ' ')
				.trim();
		}

		// Extract publisher/site name
		metadata.publisher =
			getMetaContent(doc, 'og:site_name') ||
			getMetaContent(doc, 'publisher') ||
			getMetaContent(doc, 'application-name') ||
			getMetaContent(doc, 'twitter:site')?.replace('@', '') ||
			getMetaContent(doc, 'dc.publisher') ||
			new URL(url).hostname.replace('www.', '');

		// Extract date - try multiple formats
		const rawDate =
			getMetaContent(doc, 'article:published_time') ||
			getMetaContent(doc, 'datePublished') ||
			getMetaContent(doc, 'publishdate') ||
			getMetaContent(doc, 'date') ||
			getMetaContent(doc, 'DC.date.issued') ||
			getMetaContent(doc, 'article:published') ||
			doc.querySelector('time[datetime]')?.getAttribute('datetime') ||
			doc.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ||
			'';

		if (rawDate) {
			metadata.date = formatDate(rawDate);
		}

		return metadata;
	} catch (error) {
		console.error('Failed to parse metadata:', error);
		// Return basic metadata from URL
		return {
			publisher: new URL(url).hostname.replace('www.', '')
		};
	}
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

function getMetaContent(doc: Document, property: string): string | null {
	// Try property attribute (Open Graph)
	let element = doc.querySelector(`meta[property="${property}"]`);
	if (element) return element.getAttribute('content');

	// Try name attribute
	element = doc.querySelector(`meta[name="${property}"]`);
	if (element) return element.getAttribute('content');

	return null;
}
