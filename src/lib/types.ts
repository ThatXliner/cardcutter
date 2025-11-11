export interface Author {
	firstName: string;
	lastName: string;
	qualifications: string;
	qualificationsBold: boolean[]; // tracks which characters in qualifications are bold
}

export type AuthorType = 'individual' | 'etal' | 'organization';

export interface CitationData {
	authorType: AuthorType;
	organizationName: string;
	organizationQualifications: string;
	organizationQualificationsBold: boolean[];
	authors: Author[];
	// Legacy fields for backward compatibility during migration
	isOrganization?: boolean;
	isEtAl?: boolean;
	firstName?: string;
	lastName?: string;
	qualifications?: string;
	// Standard citation fields
	date: string;
	articleTitle: string;
	source: string;
	url: string;
	dateOfAccess: string;
	code: string;
	pageNumber: string;
}

export interface HighlightLevel {
	id: number;
	name: string;
	bold: boolean;
	underline: boolean;
	fontSize: number; // percentage relative to base
	backgroundColor?: string;
	color?: string;
}

export interface TextSegment {
	text: string;
	highlightLevel: number | null; // null means no highlight
}

// Content-based highlight that moves with the text
// Uses surrounding context to identify the specific occurrence
export interface ContentHighlight {
	text: string; // The actual highlighted text content
	highlightLevel: number; 
	contextBefore: string; // Text before the highlight (for disambiguation)
	contextAfter: string; // Text after the highlight (for disambiguation)
}

export type AIProvider = 'none' | 'openai' | 'anthropic' | 'google';

export interface AIConfig {
	provider: AIProvider;
	apiKey: string;
	model: string;
}

export interface ExtractedMetadata {
	title?: string;
	author?: string;
	qualifications?: string;
	publisher?: string;
	date?: string;
	description?: string;
	aiExtracted?: boolean; // Flag indicating if AI was used for extraction
}

export interface AIModelOption {
	value: string;
	label: string;
}
