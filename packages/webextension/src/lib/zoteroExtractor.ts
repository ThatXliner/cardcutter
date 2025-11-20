/**
 * Metadata Extraction using ztractor
 *
 * This module provides metadata extraction using Zotero translators via the ztractor package.
 * Ztractor bundles 600+ Zotero translators and runs them client-side without requiring
 * an external translation-server.
 *
 * The extraction runs in the background script to avoid browser compatibility issues.
 */

export interface ZoteroCreator {
  creatorType: 'author' | 'editor' | 'contributor' | 'translator';
  firstName?: string;
  lastName?: string;
  name?: string; // For organizations
}

export interface ZoteroItem {
  itemType: string;
  title?: string;
  creators?: ZoteroCreator[];
  date?: string;
  publicationTitle?: string; // Journal/magazine name
  websiteTitle?: string; // Blog/website name
  blogTitle?: string;
  url?: string;
  accessDate?: string;
  DOI?: string;
  ISSN?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  abstractNote?: string;
  [key: string]: any; // Zotero items can have many other fields
}

export interface ZoteroTranslationResult {
  items: ZoteroItem[];
  url: string;
  success: boolean;
  error?: string;
  translator?: string;
}

/**
 * Extract metadata from a URL using Zotero translators via ztractor
 * This function sends a message to the content script which runs ztractor with native DOMParser
 */
export async function extractMetadataWithZotero(
  url: string,
  html?: string
): Promise<ZoteroTranslationResult> {
  try {
    // Get the active tab to send message to content script
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      return {
        items: [],
        url,
        success: false,
        error: 'No active tab found',
      };
    }

    // Send message to content script to run ztractor
    const response = await browser.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_METADATA_ZTRACTOR',
      payload: { url, html },
    });

    if (response.success && response.items) {
      return {
        items: response.items,
        url,
        success: true,
        translator: response.translator,
      };
    } else {
      return {
        items: [],
        url,
        success: false,
        error: response.error || 'No metadata could be extracted',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
    const [lastName, firstName] = trimmed.split(',').map(s => s.trim());
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
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
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
    item.publicationTitle ||
    item.websiteTitle ||
    item.blogTitle ||
    item.publisher ||
    ''
  );
}
