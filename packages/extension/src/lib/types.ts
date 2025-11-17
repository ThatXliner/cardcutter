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

/**
 * Position-based highlight that tracks character positions.
 *
 * This uses a position-mapping approach (similar to ProseMirror's transformation system)
 * where highlights are stored as character positions and transformed through text edits.
 *
 * ## How it works:
 *
 * 1. **Storage**: Highlights are stored as {start, end, level} positions
 * 2. **Delta Calculation**: When text changes, we calculate:
 *    - Where the edit occurred (position)
 *    - How many characters were deleted
 *    - How many characters were inserted
 * 3. **Position Transformation**: Each highlight's positions are transformed through the delta:
 *    - Edit before highlight → shift both start/end by delta
 *    - Edit after highlight → no change
 *    - Edit overlaps highlight → adjust positions or mark as deleted
 *    - Edit inside highlight → expand to include new text
 * 4. **Cleanup**: Highlights that are deleted or reduced to zero length are removed
 *
 * ## Example:
 *
 * Text: "the quick brown fox"
 * Highlight: {start: 4, end: 9, level: 1, text: "quick"}  // "quick" is highlighted
 *
 * User inserts "very " at position 4:
 * - Delta: {position: 4, deleteCount: 0, insertCount: 5}
 * - Transform: start: 4+5=9, end: 9+5=14
 * - Result: "the very quick brown fox" with "quick" still highlighted at positions 9-14
 *
 * This approach is much faster and more reliable than content-based searching,
 * as it processes highlights in O(n) time and handles all edge cases deterministically.
 */
export interface PositionHighlight {
	id: string; // Unique identifier for this highlight
	start: number; // Start character position (inclusive)
	end: number; // End character position (exclusive)
	level: number; // Highlight level ID (references HighlightLevel.id)
	text: string; // Original highlighted text (for verification/debugging)
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

// Extension-specific types for messaging between components
export interface PageData {
	url: string;
	selectedText: string;
	metadata: ExtractedMetadata;
}

export type MessageType = 'GET_PAGE_DATA' | 'PAGE_DATA_RESPONSE';

export interface ExtensionMessage {
	type: MessageType;
	data?: any;
}
