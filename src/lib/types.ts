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
