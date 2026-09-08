/**
 * Metadata Extraction using ztractor
 *
 * This module provides metadata extraction using Zotero translators via the ztractor package.
 * Ztractor bundles 600+ Zotero translators and runs them client-side without requiring
 * an external translation-server.
 */

import { extractMetadata as ztractorExtract, type ZoteroItem } from 'ztractor';

export interface ZoteroTranslationResult {
	items: ZoteroItem[];
	url: string;
	success: boolean;
	error?: string;
	translator?: string;
}

/**
 * Extract metadata from a URL using Zotero translators via ztractor
 * This runs directly in the browser using the native DOMParser
 */
export async function extractMetadataWithZtractor(
	url: string,
	html: string
): Promise<ZoteroTranslationResult> {
	try {
		console.log('🔍 [Ztractor] Starting metadata extraction...');
		console.log('🔗 [Ztractor] URL:', url);
		console.log('📄 [Ztractor] HTML length:', html?.length || 0, 'characters');

		// Use ztractor to extract metadata
		// DOMParser is available in the browser
		const result = await ztractorExtract({
			url,
			html,
			dependencies: { DOMParser },
		});

		console.log('📊 [Ztractor] Extraction result:', {
			success: result.success,
			translator: result.translator,
			itemCount: result.items?.length || 0,
			error: result.error,
		});

		if (result.success && result.items && result.items.length > 0) {
			return {
				items: result.items,
				url,
				success: true,
				translator: result.translator,
			};
		} else {
			return {
				items: [],
				url,
				success: false,
				error: result.error || 'No metadata could be extracted',
			};
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('[Ztractor] Error in extraction:', error);

		return {
			items: [],
			url,
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Parse author name into first and last name
 * Handles various formats:
 * - "John Doe" -> { firstName: "John", lastName: "Doe" }
 * - "Doe, John" -> { firstName: "John", lastName: "Doe" }
 * - "John Q. Doe" -> { firstName: "John Q.", lastName: "Doe" }
 */
export function parseAuthorName(name: string): { firstName: string; lastName: string } {
	const trimmed = name.trim();

	// Check for "Last, First" format
	if (trimmed.includes(',')) {
		const [lastName, firstName] = trimmed.split(',').map((s) => s.trim());
		return { firstName: firstName || '', lastName: lastName || '' };
	}

	// Split by whitespace
	const parts = trimmed.split(/\s+/);

	if (parts.length === 0) {
		return { firstName: '', lastName: '' };
	} else if (parts.length === 1) {
		return { firstName: '', lastName: parts[0] };
	} else {
		// Last part is last name, everything else is first name
		const lastName = parts[parts.length - 1];
		const firstName = parts.slice(0, -1).join(' ');
		return { firstName, lastName };
	}
}

/**
 * Format date from Zotero format to "Month YYYY" format
 */
export function formatZoteroDate(date: string): string {
	if (!date) return '';

	try {
		// Zotero dates can be:
		// - ISO 8601: "2023-03-15"
		// - Year only: "2023"
		// - Full timestamp: "2023-03-15T10:30:00Z"
		// - Natural: "March 2023"

		// If already in "Month YYYY" format, return as-is
		if (/^[A-Z][a-z]+ \d{4}$/.test(date)) {
			return date;
		}

		// Try to parse as date
		const parsed = new Date(date);

		if (isNaN(parsed.getTime())) {
			// If can't parse, try to extract year
			const yearMatch = date.match(/\d{4}/);
			return yearMatch ? yearMatch[0] : date;
		}

		// Format as "Month YYYY"
		const months = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December'
		];

		return `${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
	} catch (error) {
		// Fallback: try to extract year
		const yearMatch = date.match(/\d{4}/);
		return yearMatch ? yearMatch[0] : date;
	}
}

/**
 * Get publication source from Zotero item
 * Priority: publicationTitle > websiteTitle > blogTitle > publisher
 */
export function getPublicationSource(item: ZoteroItem): string {
	return (
		item.publicationTitle || item.websiteTitle || item.blogTitle || item.publisher || ''
	);
}

/**
 * Check if Zotero extraction was successful
 */
export function isZoteroExtractionSuccessful(item: ZoteroItem): boolean {
	// We consider extraction successful if we have at least a title
	return !!(item.title || item.creators?.length);
}

/**
 * Map Zotero item to ExtractedMetadata format
 */
export function mapZoteroItemToExtractedMetadata(item: ZoteroItem): {
	title?: string;
	author?: string;
	qualifications?: string;
	publisher?: string;
	date?: string;
	aiExtracted: boolean;
} {
	// Extract author names
	let authorString = '';
	if (item.creators && item.creators.length > 0) {
		const authors = item.creators
			.filter((c) => c.creatorType === 'author')
			.map((c) => {
				if (c.name) return c.name;
				return `${c.firstName || ''} ${c.lastName || ''}`.trim();
			})
			.filter((name) => name);

		if (authors.length > 0) {
			authorString = authors.join('; ');
		}
	}

	return {
		title: item.title,
		author: authorString,
		qualifications: undefined, // Qualifications will be filled by AI if configured
		publisher: getPublicationSource(item),
		date: item.date ? formatZoteroDate(item.date) : undefined,
		aiExtracted: false,
	};
}
