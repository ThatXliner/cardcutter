import type { ExtractedMetadata, AIConfig } from '$lib/types';
import { extractMetadataWithAI } from './aiMetadataExtractor';

export async function extractMetadata(
	url: string,
	aiConfig?: AIConfig
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

		// If author is missing and AI is configured, try AI extraction
		if (!metadata.author && aiConfig && aiConfig.provider !== 'none' && aiConfig.apiKey) {
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
			} catch (aiError) {
				console.error('AI extraction failed, using algorithmic results:', aiError);
				// Continue with algorithmic results
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
