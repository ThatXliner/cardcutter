import type { ExtractedMetadata, AIConfig, ExaConfig } from '$lib/types';
import { extractMetadataWithAI } from './aiMetadataExtractor';
import { findMissingMetadata } from './agenticMetadataExtractor';

export async function extractMetadata(
	url: string,
	aiConfig?: AIConfig,
	exaConfig?: ExaConfig
): Promise<ExtractedMetadata> {
	try {
		// Call the server-side API endpoint to fetch and parse metadata
		const response = await fetch('/api/extract-metadata', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url })
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

		// Check if publisher is URL-like (contains a dot, protocol, or starts with www)
		const publisherIsUrlLike = metadata.publisher &&
			(metadata.publisher.includes('.') ||
			 metadata.publisher.includes('://') ||
			 metadata.publisher.startsWith('www.'));

		// If author is missing OR publisher looks like a URL, and AI is configured, try AI extraction
		const needsAI = (!metadata.author || publisherIsUrlLike) &&
			aiConfig &&
			aiConfig.provider !== 'none' &&
			aiConfig.apiKey;

		if (needsAI) {
			try {
				const aiMetadata = await extractMetadataWithAI(url, html, aiConfig);

				// Only use AI-extracted data for missing fields
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
				// Use AI publisher if current publisher is URL-like
				if (publisherIsUrlLike && aiMetadata.publisher && !aiMetadata.publisher.includes('.')) {
					metadata.publisher = aiMetadata.publisher;
					metadata.aiExtracted = true;
				}
			} catch (aiError) {
				console.error('AI extraction failed, using algorithmic results:', aiError);
				// Continue with algorithmic results
			}
		}

		// Step 3: Agentic web search with Exa (final fallback for missing fields)
		const needsExaSearch = exaConfig &&
			exaConfig.enabled &&
			exaConfig.apiKey &&
			aiConfig &&
			aiConfig.provider !== 'none' &&
			aiConfig.apiKey &&
			(!metadata.author || !metadata.qualifications || !metadata.date);

		if (needsExaSearch) {
			try {
				console.log('[Metadata Extractor] Using Exa agentic search for missing fields...');
				const agenticMetadata = await findMissingMetadata(url, metadata, aiConfig, exaConfig);

				// Only use agentic data for missing fields
				if (!metadata.author && agenticMetadata.author) {
					metadata.author = agenticMetadata.author;
					metadata.aiExtracted = true;
				}
				if (!metadata.qualifications && agenticMetadata.qualifications) {
					metadata.qualifications = agenticMetadata.qualifications;
					metadata.aiExtracted = true;
				}
				if (!metadata.date && agenticMetadata.date) {
					metadata.date = agenticMetadata.date;
					metadata.aiExtracted = true;
				}
			} catch (exaError) {
				console.error('Exa agentic search failed:', exaError);
				// Continue with current results
			}
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
