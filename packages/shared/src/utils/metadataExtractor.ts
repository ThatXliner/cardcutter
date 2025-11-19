import type { ExtractedMetadata } from '../types';

/**
 * Interface for metadata extraction.
 * Different platforms (web app vs extension) will implement this differently.
 */
export interface MetadataExtractor {
	extractMetadata(url: string): Promise<ExtractedMetadata>;
}

/**
 * Extract metadata from HTML content using DOM parsing
 * This can be used by content scripts that have access to the page DOM
 */
export function extractMetadataFromHtml(html: string, url: string): ExtractedMetadata {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');

	const metadata: ExtractedMetadata = {
		title: '',
		author: '',
		qualifications: '',
		publisher: '',
		date: '',
		description: ''
	};

	// Extract title
	metadata.title =
		doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
		doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
		doc.querySelector('title')?.textContent ||
		'';

	// Extract author
	metadata.author =
		doc.querySelector('meta[name="author"]')?.getAttribute('content') ||
		doc.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
		'';

	// Extract publisher/site name
	metadata.publisher =
		doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
		doc.querySelector('meta[name="twitter:site"]')?.getAttribute('content') ||
		'';

	// Extract date
	const dateContent =
		doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
		doc.querySelector('meta[name="publishdate"]')?.getAttribute('content') ||
		doc.querySelector('meta[name="date"]')?.getAttribute('content') ||
		'';

	if (dateContent) {
		// Try to parse and format as "Month YYYY"
		try {
			const date = new Date(dateContent);
			const month = date.toLocaleDateString('en-US', { month: 'long' });
			const year = date.getFullYear();
			metadata.date = `${month} ${year}`;
		} catch {
			metadata.date = dateContent;
		}
	}

	// Extract description
	metadata.description =
		doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
		doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
		'';

	return metadata;
}
