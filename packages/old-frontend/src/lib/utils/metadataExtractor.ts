import type { ExtractedMetadata, AIConfig } from '$lib/types';
import { extractMetadataWithAI } from './aiMetadataExtractor';

export async function extractMetadata(
	url: string,
	aiConfig?: AIConfig,
	manualHtml?: string
): Promise<ExtractedMetadata> {
	try {
		// Call the server-side API endpoint to fetch and parse metadata
		const response = await fetch('/api/extract-metadata', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				url,
				zoteroTranslationUrl: (aiConfig?.enableZotero ?? true) ? (aiConfig?.zoteroTranslationUrl || '') : '',
				manualHtml
			})
		});

		if (!response.ok) {
			const error = await response.json();
			console.error('Failed to fetch metadata from server:', error);
			// Return basic metadata from URL
			return {
				publisher: new URL(url).hostname.replace('www.', ''),
				aiExtracted: false
			};
		}

		const { html, metadata } = await response.json();

		const enableRegex = aiConfig?.enableRegex ?? true;
		const enableAI = aiConfig?.enableAI ?? true;
		const usedZotero = !!metadata.authors;

		// If Zotero ran and succeeded, mark it; otherwise if regex is disabled, clear regex results
		if (usedZotero) {
			metadata.extractionMethod = 'zotero';
		} else if (!enableRegex) {
			// Regex fired on the server but user disabled it — discard results
			metadata.title = '';
			metadata.author = '';
			metadata.publisher = '';
			metadata.date = '';
		} else {
			metadata.extractionMethod = 'regex';
		}

		// Check if publisher is URL-like (contains a dot, protocol, or starts with www)
		const publisherIsUrlLike = metadata.publisher &&
			(metadata.publisher.includes('.') ||
			 metadata.publisher.includes('://') ||
			 metadata.publisher.startsWith('www.'));

		const needsAI = enableAI &&
			(!metadata.author && !metadata.authors?.length || publisherIsUrlLike) &&
			aiConfig &&
			aiConfig.provider !== 'none' &&
			aiConfig.apiKey;

		if (needsAI) {
			try {
				const aiMetadata = await extractMetadataWithAI(url, html, aiConfig);

				if (!metadata.author && aiMetadata.author) {
					metadata.author = aiMetadata.author;
					metadata.aiExtracted = true;
				}
				if (!metadata.qualifications && aiMetadata.qualifications) {
					metadata.qualifications = aiMetadata.qualifications;
					metadata.aiExtracted = true;
				}
				if (!metadata.title && aiMetadata.title) {
					metadata.title = aiMetadata.title;
					metadata.aiExtracted = true;
				}
				if (!metadata.date && aiMetadata.date) {
					metadata.date = aiMetadata.date;
					metadata.aiExtracted = true;
				}
				if (publisherIsUrlLike && aiMetadata.publisher && !aiMetadata.publisher.includes('.')) {
					metadata.publisher = aiMetadata.publisher;
					metadata.aiExtracted = true;
				}
				metadata.extractionMethod = 'ai';
			} catch (aiError) {
				console.error('AI extraction failed:', aiError);
			}
		}

		// Signal if nothing useful was found
		const hasAnyData = metadata.title || metadata.author || metadata.authors?.length ||
			(metadata.publisher && !publisherIsUrlLike) || metadata.date;
		if (!hasAnyData) {
			metadata.extractionMethod = undefined; // signals "nothing found"
		}

		return metadata;
	} catch (error) {
		console.error('Failed to extract metadata:', error);
		// Return basic metadata from URL
		return {
			publisher: new URL(url).hostname.replace('www.', ''),
			aiExtracted: false
		};
	}
}
