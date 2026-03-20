import type { ExtractedMetadata, AIConfig } from '$lib/types';

export async function extractMetadataWithAI(
	url: string,
	htmlContent: string,
	config: AIConfig
): Promise<ExtractedMetadata> {
	if (!config.apiKey || config.provider === 'none') {
		throw new Error('AI provider not configured');
	}

	const response = await fetch('/api/extract-metadata-ai', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			url,
			htmlContent,
			provider: config.provider,
			apiKey: config.apiKey,
			model: config.model
		})
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'AI extraction failed');
	}

	return await response.json();
}
