/**
 * Type declarations for ztractor package
 */

declare module 'ztractor' {
	export interface ExtractMetadataOptions {
		url: string;
		html?: string;
		headers?: Record<string, string>;
		timeout?: number;
	}

	export interface ZoteroCreator {
		creatorType: 'author' | 'editor' | 'contributor' | 'translator';
		firstName?: string;
		lastName?: string;
		name?: string;
	}

	export interface ZoteroItem {
		itemType: string;
		title?: string;
		creators?: ZoteroCreator[];
		date?: string;
		publicationTitle?: string;
		websiteTitle?: string;
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
		[key: string]: any;
	}

	export interface ExtractMetadataResult {
		success: boolean;
		items?: ZoteroItem[];
		error?: string;
		translator?: string;
	}

	export function extractMetadata(
		options: string | ExtractMetadataOptions
	): Promise<ExtractMetadataResult>;

	export function findTranslators(url: string): Promise<any[]>;
	export function getAvailableTranslators(): Promise<any[]>;
}
