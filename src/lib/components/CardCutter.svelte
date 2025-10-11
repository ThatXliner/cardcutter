<script lang="ts">
	import type { CitationData, TextSegment } from '$lib/types';
	import { highlightConfig } from '$lib/stores/highlightConfig.svelte';
	import { aiConfig } from '$lib/stores/aiConfig.svelte';
	import { extractMetadata } from '$lib/utils/metadataExtractor';
	import { copyRichText } from '$lib/utils/clipboard';
	import { toast } from 'svelte-sonner';
	import { Sparkles } from 'lucide-svelte';

	let url = $state('');
	let sourceText = $state('');
	let isExtracting = $state(false);
	let copySuccess = $state(false);
	let metadataWasAIExtracted = $state(false);

	let citation = $state<CitationData>({
		firstName: '',
		lastName: '',
		qualifications: '',
		date: '',
		articleTitle: '',
		source: '',
		url: '',
		dateOfAccess: new Date().toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: '2-digit'
		}),
		code: '',
		pageNumber: ''
	});

	let textSegments = $state<TextSegment[]>([]);
	let selectedText = $state('');
	let selectionStart = $state(0);
	let selectionEnd = $state(0);

	async function handleUrlBlur() {
		if (!url || url === citation.url) return;

		isExtracting = true;
		citation.url = url;
		metadataWasAIExtracted = false;

		try {
			const metadata = await extractMetadata(url, aiConfig.config);

			if (metadata.title) {
				citation.articleTitle = metadata.title;
			}

			if (metadata.author) {
				// Try to split name
				const nameParts = metadata.author.trim().split(' ');
				if (nameParts.length >= 2) {
					citation.firstName = nameParts.slice(0, -1).join(' ');
					citation.lastName = nameParts[nameParts.length - 1];
				} else {
					citation.firstName = metadata.author;
				}
			}

			if (metadata.publisher) {
				citation.source = metadata.publisher;
			}

			if (metadata.date) {
				citation.date = metadata.date;
			}

			if (metadata.qualifications) {
				citation.qualifications = metadata.qualifications;
			}

			// Show warning if AI was used
			if (metadata.aiExtracted) {
				metadataWasAIExtracted = true;
				toast.warning('Metadata extracted using AI - please verify accuracy', {
					duration: 5000,
					description: 'Author information was extracted using AI since it could not be found automatically.'
				});
			}
		} catch (error) {
			console.error('Error extracting metadata:', error);
			toast.error('Failed to extract metadata from URL');
		} finally {
			isExtracting = false;
		}
	}

	function handleTextSelection(e: Event) {
		const textarea = e.target as HTMLTextAreaElement;
		selectionStart = textarea.selectionStart;
		selectionEnd = textarea.selectionEnd;
		selectedText = sourceText.substring(selectionStart, selectionEnd);
	}

	function applyHighlight(level: number) {
		if (!selectedText || selectionStart === selectionEnd) return;

		// Build a highlight map from character position to highlight level
		const highlightMap = new Map<number, number | null>();

		// First, populate with existing highlights
		let pos = 0;
		for (const segment of textSegments) {
			for (let i = 0; i < segment.text.length; i++) {
				highlightMap.set(pos + i, segment.highlightLevel);
			}
			pos += segment.text.length;
		}

		// Apply the new highlight to selected positions (this overwrites existing highlights for these positions)
		for (let i = selectionStart; i < selectionEnd; i++) {
			highlightMap.set(i, level);
		}

		// Convert the map back to segments
		const result: TextSegment[] = [];
		let currentSegment: TextSegment | null = null;

		for (let i = 0; i < sourceText.length; i++) {
			const char = sourceText[i];
			const highlight = highlightMap.get(i) ?? null;

			if (!currentSegment || currentSegment.highlightLevel !== highlight) {
				if (currentSegment) {
					result.push(currentSegment);
				}
				currentSegment = { text: char, highlightLevel: highlight };
			} else {
				currentSegment.text += char;
			}
		}

		if (currentSegment) {
			result.push(currentSegment);
		}

		textSegments = result;
	}

	function clearHighlights() {
		textSegments = [];
	}

	function generateCitationHtml(): string {
		const {
			firstName,
			lastName,
			qualifications,
			date,
			articleTitle,
			source,
			url,
			dateOfAccess,
			code,
			pageNumber
		} = citation;

		let html = '<p style="margin: 0; font-family: Calibri, sans-serif; font-size: 13pt;">';

		// If both lastName and pageNumber are present, start with "LastName <page>" in bold
		if (lastName && pageNumber) {
			html += `<strong>${lastName} ${pageNumber}</strong>`;

			// Add firstName after a space (not bold when page number is present)
			if (firstName) {
				html += ` ${firstName}`;
			}
		} else {
			// Original format: start with firstName lastName
			// Split firstName to handle middle initials (e.g., "Michael J." -> bold only "Michael")
			const firstNameParts = firstName.trim().split(' ');
			const onlyFirstName = firstNameParts[0];
			const restOfFirstName = firstNameParts.slice(1).join(' ');

			// Name (only first name word in bold, rest normal)
			html += `<strong>${onlyFirstName}</strong>`;
			if (restOfFirstName) {
				html += ` ${restOfFirstName}`;
			}
			html += ` ${lastName}`;
		}

		// Qualifications
		if (qualifications) {
			html += ` (<strong>${qualifications}</strong>)`;
		}

		// Date (bold)
		if (date) {
			html += `; <strong>${date}</strong>`;
		}

		// Start bracket - everything from here goes inside brackets
		html += ' [';

		// Article title in italics (inside brackets, no semicolon before it)
		if (articleTitle) {
			html += `<em>${articleTitle}</em>`;
		}

		// Source (semicolon separator)
		if (source) {
			html += `; ${source}`;
		}

		// URL (semicolon separator)
		if (url) {
			html += `; ${url}`;
		}

		// Date of access (semicolon separator)
		if (dateOfAccess) {
			html += `; DOA ${dateOfAccess}`;
		}

		// Code (space before //)
		if (code) {
			html += ` //${code}`;
		}

		// Close bracket
		html += ']';

		html += '</p>';

		return html;
	}

	function generateCardHtml(): string {
		let html = generateCitationHtml();
		html += '<p style="margin-top: 8px; font-family: Calibri, sans-serif; font-size: 8pt;">';

		if (textSegments.length > 0) {
			for (const segment of textSegments) {
				const level = highlightConfig.levels.find((l) => l.id === segment.highlightLevel);

				if (level) {
					let style = 'font-family: Calibri, sans-serif; font-size: 8pt;';
					if (level.bold) style += ' font-weight: bold;';
					if (level.underline) style += ' text-decoration: underline;';
					if (level.fontSize !== 100) style += ` font-size: ${(8 * level.fontSize) / 100}pt;`;
					if (level.color && level.color !== '#000000') style += ` color: ${level.color};`;
					if (level.backgroundColor && level.backgroundColor !== '#ffffff')
						style += ` background-color: ${level.backgroundColor};`;

					html += `<span style="${style}">${escapeHtml(segment.text)}</span>`;
				} else {
					html += escapeHtml(segment.text);
				}
			}
		} else {
			html += escapeHtml(sourceText);
		}

		html += '</p>';
		return html;
	}

	function escapeHtml(text: string): string {
		// Manual HTML escaping (works in both SSR and browser)
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	async function handleCopy() {
		const html = generateCardHtml();
		const success = await copyRichText(html);
		copySuccess = success;

		if (success) {
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		}
	}
</script>

<div class="space-y-6">
		<h2 class="mb-4 text-xl font-bold">Source Information</h2>
	<div class="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">

		<div class="mb-4" data-intro="url-input">
			<label class="mb-1 block font-semibold">
				Article URL
				{#if isExtracting}
					<span class="text-sm font-normal text-gray-500">(Extracting metadata...)</span>
				{/if}
			</label>
			<input
				type="url"
				bind:value={url}
				onblur={handleUrlBlur}
				placeholder="https://example.com/article"
				class="w-full rounded border border-gray-300 px-3 py-2"
			/>
		</div>

		<div class="grid gap-4 md:grid-cols-2" data-intro="citation-fields">
			<div>
				<label class="mb-1 block font-semibold">
					First Name<span class="text-red-500">*</span>
					{#if metadataWasAIExtracted}
						<span
							class="ml-2 inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-normal text-purple-700"
							title="Extracted using AI"
						>
							<Sparkles size={12} />
							AI
						</span>
					{/if}
				</label>
				<input
					type="text"
					bind:value={citation.firstName}
					placeholder="Michael"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block font-semibold">Last Name</label>
				<input
					type="text"
					bind:value={citation.lastName}
					placeholder="Mazarr"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div class="md:col-span-2">
				<label class="mb-1 block font-semibold">Author Qualifications</label>
				<input
					type="text"
					bind:value={citation.qualifications}
					placeholder="Senior Political Scientist at the RAND Corporation"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block font-semibold">Date</label>
				<input
					type="text"
					bind:value={citation.date}
					placeholder="March 2022"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block font-semibold">Date of Access</label>
				<input
					type="text"
					bind:value={citation.dateOfAccess}
					placeholder="11/9/22"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block font-semibold">Page Number</label>
				<input
					type="text"
					bind:value={citation.pageNumber}
					placeholder="5"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div class="md:col-span-2">
				<label class="mb-1 block font-semibold">Article Title</label>
				<input
					type="text"
					bind:value={citation.articleTitle}
					placeholder="Understanding Competition: Great Power Rivalry..."
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block font-semibold">Source/Publisher</label>
				<input
					type="text"
					bind:value={citation.source}
					placeholder="RAND Corporation"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block font-semibold">Your Code</label>
				<input
					type="text"
					bind:value={citation.code}
					placeholder="VCHS CL"
					class="w-full rounded border border-gray-300 px-3 py-2"
				/>
			</div>
		</div>
	</div>

	<div class="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-bold">Evidence Text<span class="text-red-500">*</span></h2>

		<textarea
			data-intro="evidence-text"
			bind:value={sourceText}
			onmouseup={handleTextSelection}
			onkeyup={handleTextSelection}
			placeholder="Paste your evidence text here..."
			class="mb-4 h-64 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
		></textarea>

		<div class="mb-2">
			<p class="mb-2 font-semibold">Apply Highlight Level:</p>
			<div class="flex flex-wrap gap-2" data-intro="highlight-buttons">
				{#each highlightConfig.levels as level (level.id)}
					<button
						onclick={() => applyHighlight(level.id)}
						disabled={!selectedText}
						class="rounded px-4 py-2 disabled:opacity-50"
						style="
							font-weight: {level.bold ? 'bold' : 'normal'};
							text-decoration: {level.underline ? 'underline' : 'none'};
							background-color: {level.backgroundColor || '#e5e7eb'};
							color: {level.color || 'black'};
						"
					>
						{level.name}
					</button>
				{/each}
				<button
					onclick={clearHighlights}
					class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
				>
					Clear All Highlights
				</button>
			</div>
		</div>

		{#if selectedText}
			<p class="mt-2 text-sm text-gray-600">
				Selected: "{selectedText.substring(0, 50)}{selectedText.length > 50 ? '...' : ''}"
			</p>
		{/if}
	</div>

	<div class="rounded-lg border border-gray-300 bg-white p-6 shadow-sm" data-intro="preview">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-bold">Card Preview</h2>
			<button
				onclick={handleCopy}
				class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
				disabled={!sourceText || !citation.firstName}
			>
				{copySuccess ? 'Copied!' : 'Copy to Clipboard'}
			</button>
		</div>

		<div class="rounded border border-gray-200 bg-gray-50 p-4">
			{@html generateCardHtml()}
		</div>
	</div>
</div>
