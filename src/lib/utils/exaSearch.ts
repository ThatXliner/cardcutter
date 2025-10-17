import type { ExaConfig } from '$lib/types';

export interface ExaSearchResult {
	title: string;
	url: string;
	publishedDate?: string;
	author?: string;
	text?: string;
	highlights?: string[];
	highlightScores?: number[];
}

export interface ExaSearchResponse {
	results: ExaSearchResult[];
	autopromptString?: string;
}

/**
 * Search the web using Exa API
 * @param query - The search query
 * @param config - Exa configuration with API key
 * @param options - Additional search options
 */
export async function searchWithExa(
	query: string,
	config: ExaConfig,
	options: {
		numResults?: number;
		type?: 'neural' | 'keyword' | 'auto';
		category?: string;
		highlightQuery?: string;
	} = {}
): Promise<ExaSearchResponse> {
	if (!config.apiKey || !config.enabled) {
		throw new Error('Exa API is not configured or not enabled');
	}

	const {
		numResults = 5,
		type = 'neural',
		category,
		highlightQuery
	} = options;

	try {
		const requestBody: any = {
			query,
			type,
			numResults,
			contents: {
				text: { maxCharacters: 2000 },
				highlights: highlightQuery ? { query: highlightQuery, numSentences: 3 } : true
			}
		};

		if (category) {
			requestBody.category = category;
		}

		const response = await fetch('https://api.exa.ai/search', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': config.apiKey
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				`Exa API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
			);
		}

		const data = await response.json();

		// Transform Exa response to our format
		const results: ExaSearchResult[] = (data.results || []).map((result: any) => ({
			title: result.title || '',
			url: result.url || '',
			publishedDate: result.publishedDate || undefined,
			author: result.author || undefined,
			text: result.text || undefined,
			highlights: result.highlights || [],
			highlightScores: result.highlightScores || []
		}));

		return {
			results,
			autopromptString: data.autopromptString
		};
	} catch (error) {
		console.error('Exa search failed:', error);
		throw error;
	}
}
