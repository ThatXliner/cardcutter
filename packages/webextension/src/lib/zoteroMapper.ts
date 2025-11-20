/**
 * Zotero to CitationData Mapper
 *
 * Maps Zotero item metadata to CardCutter's CitationData format.
 */

import type { CitationData, Author, ExtractedMetadata } from '@acme/shared/types';
import type { ZoteroItem, ZoteroCreator } from './zoteroExtractor';
import {
  parseAuthorName,
  formatZoteroDate,
  getPublicationSource,
} from './zoteroExtractor';

/**
 * Map a Zotero creator to Author format
 */
function mapZoteroCreator(creator: ZoteroCreator): Author {
  let firstName = '';
  let lastName = '';

  if (creator.name) {
    // Organization or single name
    const parsed = parseAuthorName(creator.name);
    firstName = parsed.firstName;
    lastName = parsed.lastName;
  } else {
    // Individual with separate first/last names
    firstName = creator.firstName || '';
    lastName = creator.lastName || '';
  }

  return {
    firstName,
    lastName,
    qualifications: '', // Will be populated by AI enhancement later
    qualificationsBold: [],
  };
}

/**
 * Determine author type from Zotero creators
 */
function determineAuthorType(creators: ZoteroCreator[]): 'individual' | 'etal' | 'organization' {
  if (!creators || creators.length === 0) {
    return 'individual';
  }

  // Check if first creator is an organization (has 'name' field only)
  const firstCreator = creators[0];
  if (firstCreator.name && !firstCreator.firstName && !firstCreator.lastName) {
    return 'organization';
  }

  // Check if there are many authors (et al. case)
  // In debate citation style, typically use et al. for 3+ authors
  if (creators.length >= 3) {
    return 'etal';
  }

  return 'individual';
}

/**
 * Map a Zotero item to ExtractedMetadata (for backward compatibility)
 */
export function mapZoteroItemToExtractedMetadata(item: ZoteroItem): ExtractedMetadata {
  const creators = item.creators || [];
  const authors = creators.filter(c => c.creatorType === 'author');

  // Get author names
  let authorString = '';
  if (authors.length > 0) {
    authorString = authors
      .map(author => {
        if (author.name) return author.name;
        return `${author.firstName || ''} ${author.lastName || ''}`.trim();
      })
      .filter(name => name)
      .join('; ');
  }

  return {
    title: item.title || '',
    author: authorString,
    qualifications: '', // Will be populated by AI
    publisher: getPublicationSource(item),
    date: item.date ? formatZoteroDate(item.date) : '',
    description: item.abstractNote || '',
    aiExtracted: false,
  };
}

/**
 * Map a Zotero item to CitationData format
 */
export function mapZoteroItemToCitationData(item: ZoteroItem, url: string): Partial<CitationData> {
  const creators = item.creators || [];
  const authors = creators.filter(c => c.creatorType === 'author');

  const authorType = determineAuthorType(authors);

  // Map authors to Author format
  const mappedAuthors = authors.map(mapZoteroCreator);

  // For organization type, use the first author's name
  let organizationName = '';
  let organizationQualifications = '';
  if (authorType === 'organization' && authors.length > 0) {
    const firstAuthor = authors[0];
    organizationName = firstAuthor.name || '';
  }

  // Format date
  const formattedDate = item.date ? formatZoteroDate(item.date) : '';

  // Get publication source
  const source = getPublicationSource(item);

  // Get current date for access date
  const now = new Date();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dateOfAccess = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  return {
    authorType,
    organizationName,
    organizationQualifications,
    organizationQualificationsBold: [],
    authors: mappedAuthors,
    date: formattedDate,
    articleTitle: item.title || '',
    source,
    url: item.url || url,
    dateOfAccess,
    code: '', // User will fill this in
    pageNumber: item.pages || '',
  };
}

/**
 * Extract author names from CitationData for AI qualification extraction
 */
export function extractAuthorNamesForAI(citationData: Partial<CitationData>): string[] {
  const names: string[] = [];

  if (citationData.authorType === 'organization' && citationData.organizationName) {
    names.push(citationData.organizationName);
  } else if (citationData.authors) {
    for (const author of citationData.authors) {
      const fullName = `${author.firstName} ${author.lastName}`.trim();
      if (fullName) {
        names.push(fullName);
      }
    }
  }

  return names;
}

/**
 * Merge AI-extracted qualifications into CitationData
 */
export function mergeAIQualifications(
  citationData: Partial<CitationData>,
  aiMetadata: ExtractedMetadata
): Partial<CitationData> {
  if (!aiMetadata.qualifications) {
    return citationData;
  }

  const updated = { ...citationData };

  if (updated.authorType === 'organization') {
    // Apply qualifications to organization
    updated.organizationQualifications = aiMetadata.qualifications;
    updated.organizationQualificationsBold = [];
  } else if (updated.authors && updated.authors.length > 0) {
    // Apply qualifications to first author
    // (AI typically extracts qualifications for the primary/first author)
    updated.authors = [...updated.authors];
    updated.authors[0] = {
      ...updated.authors[0],
      qualifications: aiMetadata.qualifications,
      qualificationsBold: [],
    };
  }

  return updated;
}

/**
 * Check if Zotero extraction was successful and has useful data
 */
export function isZoteroExtractionSuccessful(item: ZoteroItem | null | undefined): boolean {
  if (!item) return false;

  // Must have at least a title or authors
  const hasTitle = !!item.title;
  const hasAuthors = !!item.creators && item.creators.length > 0;

  return hasTitle || hasAuthors;
}
