/**
 * Zotero Translator Integration
 *
 * This module provides metadata extraction using Zotero translators via translation-server.
 * Translation-server is a Node.js-based server that runs Zotero translators.
 *
 * Setup: Run `docker run -d -p 1969:1969 --name translation-server zotero/translation-server`
 * Or install from: https://github.com/zotero/translation-server
 */

export interface ZoteroTranslationServerConfig {
  /** URL of the translation-server instance (default: http://localhost:1969) */
  endpoint: string;
  /** Timeout for translation requests in milliseconds (default: 10000) */
  timeout?: number;
}

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
}

/**
 * Default translation-server configuration
 */
const DEFAULT_CONFIG: ZoteroTranslationServerConfig = {
  endpoint: 'http://localhost:1969',
  timeout: 10000,
};

/**
 * Check if translation-server is available
 */
export async function checkTranslationServerAvailable(
  config: Partial<ZoteroTranslationServerConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Quick check with 2s timeout

    const response = await fetch(finalConfig.endpoint, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Extract metadata from a URL using Zotero translators
 */
export async function extractMetadataWithZotero(
  url: string,
  html?: string,
  config: Partial<ZoteroTranslationServerConfig> = {}
): Promise<ZoteroTranslationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

    // Translation-server supports two modes:
    // 1. /web - For live URLs (translation-server fetches the page)
    // 2. /web - With POST body containing HTML (use provided HTML)

    let response: Response;

    if (html) {
      // Send HTML content for translation (preferred for browser extension)
      response = await fetch(`${finalConfig.endpoint}/web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: html,
        signal: controller.signal,
      });
    } else {
      // Let translation-server fetch the URL
      response = await fetch(`${finalConfig.endpoint}/web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: url,
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        items: [],
        url,
        success: false,
        error: `Translation-server returned status ${response.status}`,
      };
    }

    const items: ZoteroItem[] = await response.json();

    return {
      items,
      url,
      success: true,
    };
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
 * Extract metadata from identifier (DOI, ISBN, PMID, arXiv ID)
 */
export async function extractMetadataFromIdentifier(
  identifier: string,
  config: Partial<ZoteroTranslationServerConfig> = {}
): Promise<ZoteroTranslationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

    // Translation-server /search endpoint
    const response = await fetch(`${finalConfig.endpoint}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: identifier,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        items: [],
        url: identifier,
        success: false,
        error: `Translation-server returned status ${response.status}`,
      };
    }

    const items: ZoteroItem[] = await response.json();

    return {
      items,
      url: identifier,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      items: [],
      url: identifier,
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
