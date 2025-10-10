import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url } = await request.json();

		if (!url || typeof url !== 'string') {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		// Validate URL
		try {
			new URL(url);
		} catch {
			return json({ error: 'Invalid URL' }, { status: 400 });
		}

		// Fetch the URL from the server (bypasses CORS)
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; CardCutter/1.0)',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		});

		if (!response.ok) {
			return json(
				{ error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
				{ status: response.status }
			);
		}

		const html = await response.text();

		// Parse HTML and extract metadata
		// Note: We can't use DOMParser on the server, so we'll use regex/string parsing
		const metadata = {
			title: extractMetaTag(html, 'og:title') || extractMetaTag(html, 'twitter:title') || extractMetaTag(html, 'dc.title') || extractTitle(html) || '',
			author: extractMetaTag(html, 'author') || extractMetaTag(html, 'article:author') || extractMetaTag(html, 'og:article:author') || extractMetaTag(html, 'twitter:creator') || extractMetaTag(html, 'dc.creator') || extractMetaTag(html, 'parsely-author') || '',
			publisher: extractMetaTag(html, 'og:site_name') || extractMetaTag(html, 'publisher') || extractMetaTag(html, 'application-name') || extractMetaTag(html, 'twitter:site')?.replace('@', '') || extractMetaTag(html, 'dc.publisher') || new URL(url).hostname.replace('www.', ''),
			date: extractMetaTag(html, 'article:published_time') || extractMetaTag(html, 'datePublished') || extractMetaTag(html, 'publishdate') || extractMetaTag(html, 'date') || extractMetaTag(html, 'DC.date.issued') || extractMetaTag(html, 'article:published') || ''
		};

		// Clean author name
		if (metadata.author) {
			metadata.author = metadata.author
				.replace(/^by\s+/i, '')
				.replace(/\s+/g, ' ')
				.trim();
		}

		// Format date if present
		if (metadata.date) {
			metadata.date = formatDate(metadata.date);
		}

		return json({ html, metadata });
	} catch (error) {
		console.error('Metadata extraction error:', error);
		return json({ error: 'Failed to extract metadata' }, { status: 500 });
	}
};

function extractMetaTag(html: string, property: string): string | null {
	// Try property attribute (Open Graph)
	let match = html.match(
		new RegExp(`<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`, 'i')
	);
	if (match) return match[1];

	// Try name attribute
	match = html.match(
		new RegExp(`<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`, 'i')
	);
	if (match) return match[1];

	// Try reverse order (content before property/name)
	match = html.match(
		new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`, 'i')
	);
	if (match) return match[1];

	match = html.match(
		new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escapeRegex(property)}["']`, 'i')
	);
	if (match) return match[1];

	return null;
}

function extractTitle(html: string): string | null {
	const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	return match ? match[1].trim() : null;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
