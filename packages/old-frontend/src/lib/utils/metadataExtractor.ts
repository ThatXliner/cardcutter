import type { ExtractedMetadata, AIConfig } from '$lib/types';
import { extractMetadataWithAI } from './aiMetadataExtractor';
import {
	extractMetadataWithZtractor,
	mapZoteroItemToExtractedMetadata,
	isZoteroExtractionSuccessful
} from './ztractorExtractor';

export async function extractMetadata(
	url: string,
	aiConfig?: AIConfig,
	manualHtml?: string
): Promise<ExtractedMetadata> {
	try {
		let html: string;

		// If manual HTML is provided, use it directly
		if (manualHtml) {
			html = manualHtml;
		} else {
			// Call the server-side API endpoint to fetch HTML (bypasses CORS)
			const response = await fetch('/api/extract-metadata', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ url })
			});

			if (!response.ok) {
				const error = await response.json();
				console.error('Failed to fetch HTML from server:', error);
				throw new Error(
					error.error || 'Failed to fetch page content. Please provide HTML manually.'
				);
			}

			const responseData = await response.json();
			html = responseData.html;
		}

		// Extract metadata using Zotero translators (via ztractor)
		console.log('🔍 [MetadataExtractor] Starting ztractor extraction...');
		console.log('🔗 [MetadataExtractor] URL:', url);
		console.log('📄 [MetadataExtractor] HTML length:', html?.length || 0, 'characters');

		const zoteroResult = await extractMetadataWithZtractor(url, html);

		console.log('📊 [MetadataExtractor] Zotero extraction result:', {
			success: zoteroResult.success,
			translator: zoteroResult.translator,
			itemCount: zoteroResult.items?.length || 0,
			error: zoteroResult.error
		});

		if (zoteroResult.success && zoteroResult.items.length > 0) {
			const firstItem = zoteroResult.items[0];

			// Check if extraction was successful
			if (isZoteroExtractionSuccessful(firstItem)) {
				console.log(
					'✅ [MetadataExtractor] Zotero extraction successful using translator:',
					zoteroResult.translator
				);

				// Map Zotero item to ExtractedMetadata
				let metadata = mapZoteroItemToExtractedMetadata(firstItem);

				// Enhance with AI qualifications if configured and author exists but no qualifications
				const needsAI =
					metadata.author &&
					!metadata.qualifications &&
					aiConfig &&
					aiConfig.provider !== 'none' &&
					aiConfig.apiKey;

				if (needsAI) {
					try {
						console.log('🤖 [MetadataExtractor] Extracting qualifications with AI...');
						const aiMetadata = await extractMetadataWithAI(url, html, aiConfig);

						if (aiMetadata.qualifications) {
							console.log(
								'✅ [MetadataExtractor] AI extracted qualifications:',
								aiMetadata.qualifications
							);
							metadata = {
								...metadata,
								qualifications: aiMetadata.qualifications,
								aiExtracted: true
							};
						}
					} catch (aiError) {
						console.error(
							'❌ [MetadataExtractor] AI qualifications extraction failed:',
							aiError
						);
						// Continue without qualifications
					}
				}

				return metadata;
			}
		}

		// If Zotero extraction failed, throw error
		console.error('❌ [MetadataExtractor] Metadata extraction failed:', zoteroResult.error);
		console.error('❌ [MetadataExtractor] No suitable translator found for this page');
		throw new Error(
			zoteroResult.error ||
				'Metadata extraction failed. No translator could extract data from this page.'
		);
	} catch (error) {
		console.error('Failed to extract metadata:', error);
		throw error;
	}
}
