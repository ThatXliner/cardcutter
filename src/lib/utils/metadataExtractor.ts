export interface ExtractedMetadata {
	title?: string;
	author?: string;
	publisher?: string;
	date?: string;
	description?: string;
}

export async function extractMetadata(url: string): Promise<ExtractedMetadata> {
	try {
		// Use a CORS proxy for development or fetch directly if CORS is allowed
		const response = await fetch(url);
		const html = await response.text();

		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		const metadata: ExtractedMetadata = {};

		// Extract title
		metadata.title =
			getMetaContent(doc, 'og:title') ||
			getMetaContent(doc, 'twitter:title') ||
			doc.querySelector('title')?.textContent ||
			'';

		// Extract author
		metadata.author =
			getMetaContent(doc, 'author') ||
			getMetaContent(doc, 'article:author') ||
			getMetaContent(doc, 'og:article:author') ||
			doc.querySelector('[rel="author"]')?.textContent ||
			'';

		// Extract publisher/site name
		metadata.publisher =
			getMetaContent(doc, 'og:site_name') ||
			getMetaContent(doc, 'publisher') ||
			getMetaContent(doc, 'application-name') ||
			new URL(url).hostname.replace('www.', '');

		// Extract date
		metadata.date =
			getMetaContent(doc, 'article:published_time') ||
			getMetaContent(doc, 'datePublished') ||
			getMetaContent(doc, 'date') ||
			doc.querySelector('time[datetime]')?.getAttribute('datetime') ||
			'';

		// Clean up date format if it's ISO
		if (metadata.date && metadata.date.includes('T')) {
			const date = new Date(metadata.date);
			metadata.date = date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		}

		return metadata;
	} catch (error) {
		console.error('Failed to extract metadata:', error);
		return {};
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
