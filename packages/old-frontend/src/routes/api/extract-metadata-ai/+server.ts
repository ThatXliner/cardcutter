import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url, htmlContent, provider, apiKey, model } = await request.json();

		if (!apiKey || !provider || provider === 'none') {
			return json({ error: 'AI provider not configured' }, { status: 400 });
		}

		let aiProvider;
		switch (provider) {
			case 'openai':
				aiProvider = createOpenAI({ apiKey });
				break;
			case 'anthropic':
				aiProvider = createAnthropic({ apiKey });
				break;
			case 'google':
				aiProvider = createGoogleGenerativeAI({ apiKey });
				break;
			default:
				return json({ error: `Unsupported AI provider: ${provider}` }, { status: 400 });
		}

		const truncatedHtml = (htmlContent || '').substring(0, 10000);

		const { text } = await generateText({
			model: aiProvider(model),
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

		const cleaned = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
		const parsed = JSON.parse(cleaned);

		return json({
			author: parsed.author || '',
			qualifications: parsed.qualifications || '',
			title: parsed.title || '',
			publisher: parsed.publisher || '',
			date: parsed.date || '',
			aiExtracted: true
		});
	} catch (error) {
		console.error('AI metadata extraction error:', error);
		return json({ error: 'AI extraction failed' }, { status: 500 });
	}
};
