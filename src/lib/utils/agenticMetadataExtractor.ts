import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ExtractedMetadata, AIConfig, ExaConfig } from '$lib/types';
import { searchWithExa } from './exaSearch';

/**
 * Use Exa search + LLM to find missing metadata fields
 * This is an agentic approach that searches the web for information
 */
export async function findMissingMetadata(
	url: string,
	existingMetadata: ExtractedMetadata,
	aiConfig: AIConfig,
	exaConfig: ExaConfig
): Promise<Partial<ExtractedMetadata>> {
	if (!aiConfig.apiKey || aiConfig.provider === 'none') {
		throw new Error('AI provider not configured');
	}

	if (!exaConfig.apiKey || !exaConfig.enabled) {
		throw new Error('Exa is not configured or not enabled');
	}

	// Create provider instance based on config
	let provider;
	let modelId = aiConfig.model;

	switch (aiConfig.provider) {
		case 'openai':
			provider = createOpenAI({
				apiKey: aiConfig.apiKey
			});
			break;
		case 'anthropic':
			provider = createAnthropic({
				apiKey: aiConfig.apiKey
			});
			break;
		case 'google':
			provider = createGoogleGenerativeAI({
				apiKey: aiConfig.apiKey
			});
			break;
		default:
			throw new Error(`Unsupported AI provider: ${aiConfig.provider}`);
	}

	const enrichedMetadata: Partial<ExtractedMetadata> = {};

	// Extract article title and author name for context
	const articleTitle = existingMetadata.title || '';
	const authorName = existingMetadata.author || '';

	try {
		// Find author name if missing
		if (!authorName && articleTitle) {
			console.log('[Agentic] Searching for author name...');
			const authorSearchResult = await searchForAuthorName(
				articleTitle,
				url,
				exaConfig,
				provider,
				modelId
			);
			if (authorSearchResult) {
				enrichedMetadata.author = authorSearchResult;
			}
		}

		// Find author qualifications
		const currentAuthor = enrichedMetadata.author || authorName;
		if (currentAuthor && !existingMetadata.qualifications) {
			console.log('[Agentic] Searching for author qualifications...');
			const qualifications = await searchForQualifications(
				currentAuthor,
				articleTitle,
				exaConfig,
				provider,
				modelId
			);
			if (qualifications) {
				enrichedMetadata.qualifications = qualifications;
			}
		}

		// Find publication date if missing
		if (!existingMetadata.date && articleTitle) {
			console.log('[Agentic] Searching for publication date...');
			const date = await searchForPublicationDate(
				articleTitle,
				url,
				exaConfig,
				provider,
				modelId
			);
			if (date) {
				enrichedMetadata.date = date;
			}
		}

		return enrichedMetadata;
	} catch (error) {
		console.error('[Agentic] Metadata enrichment failed:', error);
		throw error;
	}
}

/**
 * Search for author name using article title
 */
async function searchForAuthorName(
	articleTitle: string,
	url: string,
	exaConfig: ExaConfig,
	provider: any,
	modelId: string
): Promise<string | null> {
	try {
		// Search for the article to find author information
		const searchQuery = `author of "${articleTitle}"`;
		const searchResults = await searchWithExa(searchQuery, exaConfig, {
			numResults: 5,
			type: 'neural',
			highlightQuery: 'author written by'
		});

		if (!searchResults.results || searchResults.results.length === 0) {
			return null;
		}

		// Use LLM to extract author name from search results
		const searchContext = searchResults.results
			.slice(0, 3)
			.map(
				(result, idx) =>
					`Result ${idx + 1}:
Title: ${result.title}
URL: ${result.url}
${result.highlights && result.highlights.length > 0 ? `Highlights: ${result.highlights.join(' ')}` : ''}
${result.text ? `Text: ${result.text.substring(0, 500)}` : ''}`
			)
			.join('\n\n');

		const { text } = await generateText({
			model: provider(modelId),
			system: `You are a metadata extraction assistant. Extract the author's name from the search results.
Return ONLY the author's full name in the format "FirstName LastName" (no additional text or explanation).
If you cannot find the author, return "NOT_FOUND".`,
			prompt: `Find the author of the article titled "${articleTitle}" from these search results:

${searchContext}

Return only the author's name (FirstName LastName) or "NOT_FOUND".`
		});

		const authorName = text.trim();
		return authorName === 'NOT_FOUND' ? null : authorName;
	} catch (error) {
		console.error('[Agentic] Author name search failed:', error);
		return null;
	}
}

/**
 * Search for author qualifications and credentials
 */
async function searchForQualifications(
	authorName: string,
	articleTitle: string,
	exaConfig: ExaConfig,
	provider: any,
	modelId: string
): Promise<string | null> {
	try {
		// Search for author bio/credentials
		const searchQuery = `${authorName} credentials qualifications background bio`;
		const searchResults = await searchWithExa(searchQuery, exaConfig, {
			numResults: 5,
			type: 'neural',
			category: 'personal site',
			highlightQuery: `${authorName} position title affiliation credentials education`
		});

		if (!searchResults.results || searchResults.results.length === 0) {
			return null;
		}

		// Use LLM to extract qualifications from search results
		const searchContext = searchResults.results
			.slice(0, 3)
			.map(
				(result, idx) =>
					`Result ${idx + 1}:
Title: ${result.title}
URL: ${result.url}
${result.highlights && result.highlights.length > 0 ? `Highlights: ${result.highlights.join(' ')}` : ''}
${result.text ? `Text: ${result.text.substring(0, 500)}` : ''}`
			)
			.join('\n\n');

		const { text } = await generateText({
			model: provider(modelId),
			system: `You are a metadata extraction assistant. Extract the author's professional qualifications.
Return a concise credential string (e.g., "Senior Political Scientist at the RAND Corporation", "Professor of Economics at MIT", "CEO of TechCorp").
Focus on the most relevant professional title, affiliation, or credential.
If you cannot find qualifications, return "NOT_FOUND".`,
			prompt: `Find the professional qualifications/credentials for ${authorName} from these search results:

${searchContext}

Return only a concise qualification string or "NOT_FOUND".`
		});

		const qualifications = text.trim();
		return qualifications === 'NOT_FOUND' ? null : qualifications;
	} catch (error) {
		console.error('[Agentic] Qualifications search failed:', error);
		return null;
	}
}

/**
 * Search for publication date
 */
async function searchForPublicationDate(
	articleTitle: string,
	url: string,
	exaConfig: ExaConfig,
	provider: any,
	modelId: string
): Promise<string | null> {
	try {
		// Search for the article to find publication date
		const searchQuery = `"${articleTitle}" publication date`;
		const searchResults = await searchWithExa(searchQuery, exaConfig, {
			numResults: 5,
			type: 'neural',
			highlightQuery: 'published date'
		});

		if (!searchResults.results || searchResults.results.length === 0) {
			return null;
		}

		// Check if Exa already found publishedDate
		for (const result of searchResults.results) {
			if (result.publishedDate) {
				// Format as "Month YYYY"
				const date = new Date(result.publishedDate);
				const month = date.toLocaleDateString('en-US', { month: 'long' });
				const year = date.getFullYear();
				return `${month} ${year}`;
			}
		}

		// Use LLM to extract date from search results
		const searchContext = searchResults.results
			.slice(0, 3)
			.map(
				(result, idx) =>
					`Result ${idx + 1}:
Title: ${result.title}
URL: ${result.url}
${result.highlights && result.highlights.length > 0 ? `Highlights: ${result.highlights.join(' ')}` : ''}
${result.text ? `Text: ${result.text.substring(0, 500)}` : ''}`
			)
			.join('\n\n');

		const { text } = await generateText({
			model: provider(modelId),
			system: `You are a metadata extraction assistant. Extract the publication date.
Return the date in format "Month YYYY" (e.g., "March 2022", "December 2023").
If you cannot find a date, return "NOT_FOUND".`,
			prompt: `Find the publication date for the article "${articleTitle}" from these search results:

${searchContext}

Return only the date in format "Month YYYY" or "NOT_FOUND".`
		});

		const date = text.trim();
		return date === 'NOT_FOUND' ? null : date;
	} catch (error) {
		console.error('[Agentic] Publication date search failed:', error);
		return null;
	}
}
