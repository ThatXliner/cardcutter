export interface CitationData {
	firstName: string;
	lastName: string;
	qualifications: string;
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

export interface ExaConfig {
	apiKey: string;
	enabled: boolean;
}
