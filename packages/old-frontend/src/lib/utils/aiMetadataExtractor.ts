import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ExtractedMetadata, AIConfig } from '$lib/types';

export async function extractMetadataWithAI(
	url: string,
	htmlContent: string,
	config: AIConfig
): Promise<ExtractedMetadata> {
	if (!config.apiKey || config.provider === 'none') {
		throw new Error('AI provider not configured');
	}

	try {
		// Create provider instance based on config
		let provider;
		let modelId = config.model;

		switch (config.provider) {
			case 'openai':
				provider = createOpenAI({
					apiKey: config.apiKey
				});
				break;
			case 'anthropic':
				provider = createAnthropic({
					apiKey: config.apiKey
				});
				break;
			case 'google':
				provider = createGoogleGenerativeAI({
					apiKey: config.apiKey
				});
				break;
			default:
				throw new Error(`Unsupported AI provider: ${config.provider}`);
		}

		// Truncate HTML to avoid token limits (keep first 10000 chars)
		const truncatedHtml = htmlContent.substring(0, 10000);

		const { text } = await generateText({
			model: provider(modelId),
			system: `You are a metadata extraction assistant. Extract article metadata from HTML content.
Return ONLY a valid JSON object with these fields (use empty string if not found):
{
  "author": "Full author name (First Last). For multiple authors, separate with semicolons (e.g., 'John Doe; Jane Smith')",
  "qualifications": "Author's credentials, job title, or organizational affiliation (e.g., 'Senior Political Scientist at the RAND Corporation')",
  "title": "Article title",
  "publisher": "Publisher/site name",
  "date": "Publication date in format 'Month YYYY' (e.g., 'March 2022')"
}`,
			prompt: `Extract metadata from this article HTML:

URL: ${url}

HTML Content:
${truncatedHtml}

Return only the JSON object, no additional text.`
		});

		// Parse the AI response
		const cleaned = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
		const parsed = JSON.parse(cleaned);

		return {
			author: parsed.author || '',
			qualifications: parsed.qualifications || '',
			title: parsed.title || '',
			publisher: parsed.publisher || '',
			date: parsed.date || '',
			aiExtracted: true
		};
	} catch (error) {
		console.error('AI metadata extraction failed:', error);
		throw error;
	}
}
