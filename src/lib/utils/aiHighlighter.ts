import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AIConfig, HighlightLevel, HighlightRange } from '$lib/types';

export async function autoHighlightWithAI(
	text: string,
	highlightLevels: HighlightLevel[],
	config: AIConfig
): Promise<HighlightRange[]> {
	if (!config.apiKey || config.provider === 'none') {
		throw new Error('AI provider not configured');
	}

	if (!text.trim()) {
		throw new Error('No text to highlight');
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

		// Build level descriptions for the prompt
		const levelDescriptions = highlightLevels
			.map(
				(level) =>
					`  - Level ${level.id} (${level.name}): ${level.id === 1 ? 'HIGHEST priority - Key claims, critical warrants, impact statements, must-say keywords that the debater should emphasize' : level.id === highlightLevels.length ? 'LOWEST priority - Supporting details, contextual information, less essential text' : 'MEDIUM priority - Important supporting evidence, relevant context, moderately important details'}`
			)
			.join('\n');

		const { text: aiResponse } = await generateText({
			model: provider(modelId),
			system: `You are an expert debate coach helping students highlight evidence cards for NSDA policy debate. Your task is to identify what parts of the evidence a debater should SAY OUT LOUD when reading the card in a debate round.

Guidelines for highlighting:
- **HIGHEST level (Level 1)**: The absolute MUST-SAY words and phrases. These are:
  * Key claims and thesis statements
  * Critical warrants (the "why" behind arguments)
  * Impact statements (consequences, significance)
  * Essential keywords that communicate the core argument
  * Statistics, dates, or facts that are crucial to the argument

- **MEDIUM levels**: Supporting evidence that strengthens the argument:
  * Important context that helps the argument make sense
  * Secondary evidence and examples
  * Moderately important qualifiers or explanations

- **LOWEST level**: Background information that may be helpful but not essential:
  * Contextual details
  * Less critical supporting information
  * Transitional phrases

- **NO HIGHLIGHT**: Information that can be skipped:
  * Filler words
  * Overly verbose explanations
  * Redundant information
  * Purely background/setup text

Remember: Debaters speak FAST. Only highlight what they need to say to make the argument compelling and complete. Be selective - over-highlighting defeats the purpose.

Return ONLY a valid JSON array of highlight ranges. Each range must have:
- "start": character position (0-indexed) where highlight begins
- "end": character position where highlight ends (exclusive)
- "level": the highlight level ID to apply

Example format:
[
  {"start": 0, "end": 25, "level": 1},
  {"start": 30, "end": 45, "level": 2}
]

CRITICAL: Ranges must not overlap. If text deserves multiple levels, choose the HIGHEST priority level only.`,
			prompt: `Analyze this debate evidence and identify what the debater should say. Apply highlight levels based on importance:

Available highlight levels:
${levelDescriptions}

Evidence text:
${text}

Return only the JSON array of highlight ranges.`
		});

		// Parse the AI response
		const cleaned = aiResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
		const parsed: HighlightRange[] = JSON.parse(cleaned);

		// Validate the response
		if (!Array.isArray(parsed)) {
			throw new Error('AI response is not an array');
		}

		// Validate and sanitize ranges
		const validRanges: HighlightRange[] = [];
		const maxLength = text.length;

		for (const range of parsed) {
			if (
				typeof range.start !== 'number' ||
				typeof range.end !== 'number' ||
				typeof range.level !== 'number'
			) {
				console.warn('Invalid range format, skipping:', range);
				continue;
			}

			// Clamp to text bounds
			const start = Math.max(0, Math.min(range.start, maxLength));
			const end = Math.max(start, Math.min(range.end, maxLength));

			// Only add if range is valid
			if (start < end && highlightLevels.some((l) => l.id === range.level)) {
				validRanges.push({ start, end, level: range.level });
			}
		}

		// Sort by start position to ensure proper ordering
		validRanges.sort((a, b) => a.start - b.start);

		return validRanges;
	} catch (error) {
		console.error('AI highlighting failed:', error);
		throw error;
	}
}
