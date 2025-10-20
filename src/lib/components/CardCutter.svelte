<script lang="ts">
	import type { CitationData, TextSegment, Author } from '$lib/types';
	import { highlightConfig } from '$lib/stores/highlightConfig.svelte';
	import { aiConfig } from '$lib/stores/aiConfig.svelte';
	import { extractMetadata } from '$lib/utils/metadataExtractor';
	import { copyRichText } from '$lib/utils/clipboard';
	import { toast } from 'svelte-sonner';
	import { Sparkles, Plus, X } from 'lucide-svelte';
	import QualificationInput from './QualificationInput.svelte';

	const CODE_STORAGE_KEY = 'cardcutter_user_code';

	// Load code from localStorage
	function loadCode(): string {
		if (typeof window === 'undefined') return '';
		const stored = localStorage.getItem(CODE_STORAGE_KEY);
		return stored || '';
	}

	// Save code to localStorage
	function saveCode(code: string) {
		if (typeof window === 'undefined') return;
		localStorage.setItem(CODE_STORAGE_KEY, code);
	}

	// Migration helper for old citation data
	function migrateLegacyCitation(oldData: any): CitationData {
		// Check if already in new format
		if (oldData.authors !== undefined) {
			return oldData;
		}

		// Convert old format to new format
		const authors: Author[] = [];
		if (oldData.firstName || oldData.lastName) {
			authors.push({
				firstName: oldData.firstName || '',
				lastName: oldData.lastName || '',
				qualifications: oldData.qualifications || '',
				qualificationsBold: [] // No bold info in legacy data
			});
		}

		return {
			isOrganization: false,
			organizationName: '',
			authors,
			date: oldData.date || '',
			articleTitle: oldData.articleTitle || '',
			source: oldData.source || '',
			url: oldData.url || '',
			dateOfAccess: oldData.dateOfAccess || new Date().toLocaleDateString('en-US', {
				month: '2-digit',
				day: '2-digit',
				year: '2-digit'
			}),
			code: oldData.code || loadCode(),
			pageNumber: oldData.pageNumber || ''
		};
	}

	let url = $state('');
	let sourceText = $state('');
	let isExtracting = $state(false);
	let copySuccess = $state(false);
	let metadataWasAIExtracted = $state(false);

	let citation = $state<CitationData>({
		isOrganization: false,
		organizationName: '',
		authors: [{
			firstName: '',
			lastName: '',
			qualifications: '',
			qualificationsBold: []
		}],
		date: '',
		articleTitle: '',
		source: '',
		url: '',
		dateOfAccess: new Date().toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: '2-digit'
		}),
		code: loadCode(),
		pageNumber: ''
	});

	// Watch for code changes and save to localStorage
	$effect(() => {
		saveCode(citation.code);
	});

	let textSegments = $state<TextSegment[]>([]);
	let selectedText = $state('');
	let selectionStart = $state(0);
	let selectionEnd = $state(0);

	function addAuthor() {
		citation.authors = [...citation.authors, {
			firstName: '',
			lastName: '',
			qualifications: '',
			qualificationsBold: []
		}];
	}

	function removeAuthor(index: number) {
		if (citation.authors.length > 1) {
			citation.authors = citation.authors.filter((_, i) => i !== index);
		}
	}

	function toggleOrganization() {
		citation.isOrganization = !citation.isOrganization;
	}

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
				// Split by semicolons to handle multiple authors
				const authorStrings = metadata.author.split(';').map(a => a.trim()).filter(a => a);
				const newAuthors: Author[] = [];

				for (const authorString of authorStrings) {
					// Try to split name
					const nameParts = authorString.trim().split(' ');
					const author: Author = {
						firstName: '',
						lastName: '',
						qualifications: metadata.qualifications || '',
						qualificationsBold: []
					};

					if (nameParts.length >= 2) {
						author.firstName = nameParts.slice(0, -1).join(' ');
						author.lastName = nameParts[nameParts.length - 1];
					} else {
						author.firstName = authorString;
					}

					newAuthors.push(author);
				}

				if (newAuthors.length > 0) {
					citation.authors = newAuthors;
				}
			}

			if (metadata.publisher) {
				citation.source = metadata.publisher;
			}

			if (metadata.date) {
				citation.date = metadata.date;
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

	function clearSelectedHighlights() {
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

		// Clear highlights for selected positions
		for (let i = selectionStart; i < selectionEnd; i++) {
			highlightMap.set(i, null);
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
			isOrganization,
			organizationName,
			authors,
			date,
			articleTitle,
			source,
			url,
			dateOfAccess,
			code,
			pageNumber
		} = citation;

		let html = '<p style="margin: 0; font-family: Calibri, sans-serif; font-size: 13pt;">';

		// Handle organization mode
		if (isOrganization) {
			html += `<strong>${organizationName}</strong>`;
		} else {
			// Handle individual authors
			// Format: Author 1 (Quals); Author 2 (Quals); Author 3 (Quals) Date
			for (let i = 0; i < authors.length; i++) {
				const author = authors[i];
				const { firstName, lastName, qualifications, qualificationsBold } = author;

				if (i > 0) {
					html += '; ';
				}

				// Name formatting (same logic as before, but for each author)
				if (lastName && pageNumber && i === 0) {
					// Only apply page number logic to first author
					html += `<strong>${lastName} ${pageNumber}</strong>`;
					if (firstName) {
						html += ` ${firstName}`;
					}
				} else if (lastName && firstName) {
					html += `<strong>${lastName}</strong>, ${firstName}`;
				} else if (firstName) {
					// Fallback: just firstName with first word bold
					const firstNameParts = firstName.trim().split(' ');
					const onlyFirstName = firstNameParts[0];
					const restOfFirstName = firstNameParts.slice(1).join(' ');

					html += `<strong>${onlyFirstName}</strong>`;
					if (restOfFirstName) {
						html += ` ${restOfFirstName}`;
					}
					if (lastName) {
						html += ` ${lastName}`;
					}
				}

				// Qualifications with selective bolding
				if (qualifications) {
					html += ' (';

					// Build qualifications HTML with selective bolding
					let currentBold = false;
					for (let j = 0; j < qualifications.length; j++) {
						const char = qualifications[j];
						const isBold = qualificationsBold[j] || false;

						if (isBold !== currentBold) {
							if (currentBold) {
								html += '</strong>';
							}
							if (isBold) {
								html += '<strong>';
							}
							currentBold = isBold;
						}

						// Escape HTML characters
						const escaped = char
							.replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;')
							.replace(/"/g, '&quot;')
							.replace(/'/g, '&#039;');

						html += escaped;
					}

					if (currentBold) {
						html += '</strong>';
					}

					html += ')';
				}
			}
		}

		// Date (only year is bold) - comes after all authors
		if (date) {
			// Try to extract year and bold only that
			const yearMatch = date.match(/\b(\d{4})\b/);
			if (yearMatch) {
				const year = yearMatch[1];
				const dateWithBoldYear = date.replace(year, `<strong>${year}</strong>`);
				html += ` ${dateWithBoldYear}`;
			} else {
				// If no year found, just add the date as-is
				html += ` ${date}`;
			}
		}

		// Start bracket - everything from here goes inside brackets
		html += ' [';

		// Article title in italics (inside brackets, no semicolon before it)
		if (articleTitle) {
			html += `<em>${articleTitle}</em>`;
		}

		// Source/Publisher (only include if it's not just a URL-like string)
		// Skip if source looks like a URL (contains protocol, starts with www, or contains a dot like "example.com")
		const sourceIsUrl = source && (source.includes('://') || source.startsWith('www.') || source.includes('.'));
		if (source && !sourceIsUrl) {
			html += `; ${source}`;
		}

		// URL always comes after source/publisher (semicolon separator)
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

		<div class="mb-4">
			<div class="mb-4 flex items-center gap-4">
				<span class="font-semibold">Author Type:</span>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						checked={!citation.isOrganization}
						onchange={() => citation.isOrganization = false}
						name="authorType"
					/>
					Individual Authors
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						checked={citation.isOrganization}
						onchange={() => citation.isOrganization = true}
						name="authorType"
					/>
					Organization
				</label>
			</div>

			{#if citation.isOrganization}
				<div>
					<label class="mb-1 block font-semibold">Organization Name<span class="text-red-500">*</span></label>
					<input
						type="text"
						bind:value={citation.organizationName}
						placeholder="RAND Corporation"
						class="w-full rounded border border-gray-300 px-3 py-2"
					/>
				</div>
			{:else}
				<div class="space-y-6" data-intro="citation-fields">
					{#each citation.authors as author, index (index)}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
							<div class="mb-2 flex items-center justify-between">
								<h3 class="font-semibold">
									Author {index + 1}
									{#if metadataWasAIExtracted && index === 0}
										<span
											class="ml-2 inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-normal text-purple-700"
											title="Extracted using AI"
										>
											<Sparkles size={12} />
											AI
										</span>
									{/if}
								</h3>
								{#if citation.authors.length > 1}
									<button
										onclick={() => removeAuthor(index)}
										class="rounded bg-red-500 p-1 text-white hover:bg-red-600"
										type="button"
										title="Remove author"
									>
										<X size={16} />
									</button>
								{/if}
							</div>

							<div class="grid gap-4 md:grid-cols-2">
								<div>
									<label class="mb-1 block font-semibold">
										First Name{#if index === 0}<span class="text-red-500">*</span>{/if}
									</label>
									<input
										type="text"
										bind:value={author.firstName}
										placeholder="Michael"
										class="w-full rounded border border-gray-300 px-3 py-2"
									/>
								</div>

								<div>
									<label class="mb-1 block font-semibold">Last Name</label>
									<input
										type="text"
										bind:value={author.lastName}
										placeholder="Mazarr"
										class="w-full rounded border border-gray-300 px-3 py-2"
									/>
								</div>
							</div>

							<div class="mt-4">
								<label class="mb-1 block font-semibold">Qualifications</label>
								<QualificationInput
									bind:value={author.qualifications}
									bind:boldArray={author.qualificationsBold}
									placeholder="Senior Political Scientist at the RAND Corporation"
								/>
							</div>
						</div>
					{/each}

					<button
						onclick={addAuthor}
						class="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
						type="button"
					>
						<Plus size={16} />
						Add Author
					</button>
				</div>
			{/if}
		</div>

		<div class="grid gap-4 md:grid-cols-2">

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
					onclick={clearSelectedHighlights}
					disabled={!selectedText}
					class="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
				>
					Clear Selected
				</button>
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
				disabled={!sourceText || (citation.isOrganization ? !citation.organizationName : !citation.authors[0]?.firstName)}
			>
				{copySuccess ? 'Copied!' : 'Copy to Clipboard'}
			</button>
		</div>

		<div class="rounded border border-gray-200 bg-gray-50 p-4">
			{@html generateCardHtml()}
		</div>
	</div>
</div>
