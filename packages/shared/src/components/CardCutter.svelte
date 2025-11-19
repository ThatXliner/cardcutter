<script lang="ts">
	import type { CitationData, TextSegment, Author, PositionHighlight, ExtractedMetadata } from '../types';
	import { highlightConfig } from '../stores/highlightConfig.svelte';
	import { aiConfig } from '../stores/aiConfig.svelte';
	import { copyRichText } from '../utils/clipboard';
	import { generateCardHtml } from '../utils/citation';
	import { toast } from 'svelte-sonner';
	import { Sparkles, Plus, X } from 'lucide-svelte';
	import QualificationInput from './QualificationInput.svelte';

	interface Props {
		extractMetadata?: (url: string) => Promise<ExtractedMetadata>;
		initialUrl?: string;
	}

	let { extractMetadata, initialUrl = '' }: Props = $props();

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
		// Check if already in new format with authorType
		if (oldData.authorType) {
			return oldData;
		}

		// Migrate from boolean flags to authorType
		let authorType: 'individual' | 'etal' | 'organization' = 'individual';
		if (oldData.isOrganization) {
			authorType = 'organization';
		} else if (oldData.isEtAl) {
			authorType = 'etal';
		}

		// Check if already has authors array
		if (oldData.authors !== undefined) {
			return {
				...oldData,
				authorType
			};
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
			authorType,
			organizationName: '',
			organizationQualifications: '',
			organizationQualificationsBold: [],
			authors,
			date: oldData.date || '',
			articleTitle: oldData.articleTitle || '',
			source: oldData.source || '',
			url: oldData.url || '',
			dateOfAccess:
				oldData.dateOfAccess ||
				new Date().toLocaleDateString('en-US', {
					month: '2-digit',
					day: '2-digit',
					year: '2-digit'
				}),
			code: oldData.code || loadCode(),
			pageNumber: oldData.pageNumber || ''
		};
	}

	let url = $state(initialUrl);
	let sourceText = $state('');
	let isExtracting = $state(false);
	let copySuccess = $state(false);
	let metadataWasAIExtracted = $state(false);

	let citation = $state<CitationData>({
		authorType: 'individual',
		organizationName: '',
		organizationQualifications: '',
		organizationQualificationsBold: [],
		authors: [
			{
				firstName: '',
				lastName: '',
				qualifications: '',
				qualificationsBold: []
			}
		],
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
	let highlights = $state<PositionHighlight[]>([]); // Position-based highlights that transform through edits
	let selectedText = $state('');
	let selectionStart = $state(0);
	let selectionEnd = $state(0);

	// Track previous state for delta calculation
	let previousText = $state('');
	let previousSelectionStart = $state(0);
	let previousSelectionEnd = $state(0);

	/**
	 * Calculate the delta (difference) between old and new text.
	 *
	 * This finds where the text changed by comparing character-by-character from both ends.
	 * The delta describes what edit operation occurred: where it happened, how many characters
	 * were deleted, and how many were inserted.
	 *
	 * @returns {position, deleteCount, insertCount} describing the edit operation
	 *
	 * @example
	 * // User types "very " before "quick"
	 * calculateDelta("the quick", "the very quick", ...)
	 * // Returns: {position: 4, deleteCount: 0, insertCount: 5}
	 */
	function calculateDelta(oldText: string, newText: string, oldStart: number, oldEnd: number) {
		// Find where the text diverges from the beginning
		let changeStart = 0;
		while (
			changeStart < oldText.length &&
			changeStart < newText.length &&
			oldText[changeStart] === newText[changeStart]
		) {
			changeStart++;
		}

		// Find where the text diverges from the end
		let oldSuffix = 0;
		let newSuffix = 0;
		while (
			oldSuffix < oldText.length - changeStart &&
			newSuffix < newText.length - changeStart &&
			oldText[oldText.length - 1 - oldSuffix] === newText[newText.length - 1 - newSuffix]
		) {
			oldSuffix++;
			newSuffix++;
		}

		const deleteCount = oldText.length - changeStart - oldSuffix;
		const insertCount = newText.length - changeStart - newSuffix;

		return {
			position: changeStart,
			deleteCount,
			insertCount
		};
	}

	/**
	 * Transform a highlight's positions through a text edit operation.
	 *
	 * This is the core of the position-mapping system. Based on where the edit occurred
	 * relative to the highlight, we calculate new positions or mark the highlight as deleted.
	 *
	 * ## Edge Cases Handled:
	 *
	 * 1. **Edit before highlight**: Shift both start/end by (insertCount - deleteCount)
	 *    - Example: Insert "very " at pos 0, highlight at 10-15 → becomes 15-20
	 *
	 * 2. **Edit after highlight**: No change needed
	 *    - Example: Insert "!" at pos 20, highlight at 10-15 → stays 10-15
	 *
	 * 3. **Edit completely covers highlight**: Mark as deleted
	 *    - Example: Delete chars 8-17, highlight at 10-15 → deleted
	 *
	 * 4. **Edit overlaps highlight start**: Move start to end of edit
	 *    - Example: Delete chars 8-12, highlight at 10-15 → becomes 8-11
	 *
	 * 5. **Edit inside highlight**: Expand highlight to include new text
	 *    - Example: Insert "very " at pos 12, highlight at 10-15 → becomes 10-20
	 *
	 * 6. **Edit starts inside and extends beyond**: Truncate highlight at edit start
	 *    - Example: Delete chars 12-20, highlight at 10-15 → becomes 10-12
	 *
	 * @returns {start, end, deleted} - New positions or {deleted: true} if highlight was destroyed
	 */
	function transformHighlightPosition(
		start: number,
		end: number,
		editPos: number,
		deleteCount: number,
		insertCount: number
	): { start: number; end: number; deleted: boolean } {
		// Edit is completely before the highlight - shift both positions
		if (editPos + deleteCount <= start) {
			const delta = insertCount - deleteCount;
			return { start: start + delta, end: end + delta, deleted: false };
		}

		// Edit is completely after the highlight - no change
		if (editPos >= end) {
			return { start, end, deleted: false };
		}

		// Edit overlaps with or is inside the highlight
		// Case: Edit covers entire highlight
		if (editPos <= start && editPos + deleteCount >= end) {
			return { start: -1, end: -1, deleted: true };
		}

		// Case: Edit overlaps highlight start
		if (editPos <= start && editPos + deleteCount > start) {
			const newStart = editPos + insertCount;
			const newEnd = end - deleteCount + insertCount;
			return { start: newStart, end: newEnd, deleted: newEnd <= newStart };
		}

		// Case: Edit is inside highlight
		if (editPos > start && editPos + deleteCount < end) {
			const delta = insertCount - deleteCount;
			return { start, end: end + delta, deleted: false };
		}

		// Case: Edit starts inside and extends beyond highlight end
		if (editPos > start && editPos < end && editPos + deleteCount >= end) {
			return { start, end: editPos, deleted: editPos <= start };
		}

		// Fallback
		return { start, end, deleted: false };
	}

	// Rebuild text segments from source text and position highlights
	function rebuildSegments() {
		if (highlights.length === 0) {
			textSegments = [];
			return;
		}

		// Build position map from highlights
		const positionMap = new Map<number, number>();

		for (const highlight of highlights) {
			// Mark all positions in this highlight
			for (let i = highlight.start; i < highlight.end && i < sourceText.length; i++) {
				positionMap.set(i, highlight.level);
			}
		}

		// Build segments from position map
		const result: TextSegment[] = [];
		let currentSegment: TextSegment | null = null;

		for (let i = 0; i < sourceText.length; i++) {
			const char = sourceText[i];
			const highlightLevel = positionMap.get(i) ?? null;

			if (!currentSegment || currentSegment.highlightLevel !== highlightLevel) {
				if (currentSegment) {
					result.push(currentSegment);
				}
				currentSegment = { text: char, highlightLevel };
			} else {
				currentSegment.text += char;
			}
		}

		if (currentSegment) {
			result.push(currentSegment);
		}

		textSegments = result;
	}

	/**
	 * Handle text input events and transform all highlight positions.
	 *
	 * This is called on every text change (typing, paste, delete, etc.).
	 * It calculates what changed, transforms all highlights through that change,
	 * and rebuilds the visual segments.
	 *
	 * ## Process:
	 * 1. Calculate delta between previous and current text
	 * 2. Transform each highlight's positions through the delta
	 * 3. Filter out highlights that were deleted or became invalid
	 * 4. Rebuild the visual segments for rendering
	 * 5. Update previous state for next change
	 */
	function handleTextInput(e: Event) {
		const newText = sourceText;

		// Calculate delta if text changed
		if (newText !== previousText) {
			const delta = calculateDelta(
				previousText,
				newText,
				previousSelectionStart,
				previousSelectionEnd
			);

			// Transform all highlight positions
			highlights = highlights
				.map((h) => {
					const result = transformHighlightPosition(
						h.start,
						h.end,
						delta.position,
						delta.deleteCount,
						delta.insertCount
					);

					if (result.deleted) {
						return null;
					}

					return {
						...h,
						start: result.start,
						end: result.end
					};
				})
				.filter((h): h is PositionHighlight => h !== null && h.end > h.start);

			// Rebuild segments with transformed positions
			rebuildSegments();

			// Update previous state
			previousText = newText;
		}
	}

	function addAuthor() {
		citation.authors = [
			...citation.authors,
			{
				firstName: '',
				lastName: '',
				qualifications: '',
				qualificationsBold: []
			}
		];
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
		if (!url || url === citation.url || !extractMetadata) return;

		isExtracting = true;
		citation.url = url;
		metadataWasAIExtracted = false;

		try {
			const metadata = await extractMetadata(url);

			if (metadata.title) {
				citation.articleTitle = metadata.title;
			}

			if (metadata.author) {
				// Split by semicolons to handle multiple authors
				const authorStrings = metadata.author
					.split(';')
					.map((a) => a.trim())
					.filter((a) => a);
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
					description:
						'Author information was extracted using AI since it could not be found automatically.'
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
		previousSelectionStart = selectionStart;
		previousSelectionEnd = selectionEnd;
		selectionStart = textarea.selectionStart;
		selectionEnd = textarea.selectionEnd;
		selectedText = sourceText.substring(selectionStart, selectionEnd);
	}

	function applyHighlight(level: number) {
		if (!selectedText || selectionStart === selectionEnd) return;

		const highlightedText = selectedText;

		// Check if there's already a highlight at this exact position
		const existingIndex = highlights.findIndex(
			(h) => h.start === selectionStart && h.end === selectionEnd
		);

		if (existingIndex !== -1) {
			// Update existing highlight at this position
			highlights[existingIndex] = {
				...highlights[existingIndex],
				level,
				text: highlightedText
			};
		} else {
			// Add new position highlight with unique ID
			const newHighlight: PositionHighlight = {
				id: `${Date.now()}-${Math.random()}`,
				start: selectionStart,
				end: selectionEnd,
				level,
				text: highlightedText
			};
			highlights = [...highlights, newHighlight];
		}

		// Rebuild segments from highlights
		rebuildSegments();
	}

	/**
	 * Clear highlights within the selected text range.
	 *
	 * This removes only the selected portion of highlights, potentially splitting
	 * a single highlight into two separate highlights if the selection is in the middle.
	 * The text itself remains unchanged - only the highlight positions are modified.
	 *
	 * ## Cases handled:
	 * 1. Selection completely covers highlight → remove entire highlight
	 * 2. Selection overlaps start of highlight → trim highlight start
	 * 3. Selection overlaps end of highlight → trim highlight end
	 * 4. Selection is inside highlight → split into two highlights
	 * 5. Selection doesn't overlap highlight → keep unchanged
	 *
	 * ## Example:
	 * Text: "the quick brown fox"
	 * Highlight: positions 4-15 (level 1) - covers "quick brown"
	 * User selects positions 10-12 (the word "brown" start)
	 * Result: Two highlights: [4-10] covering "quick " and [12-15] covering "own"
	 */
	function clearSelectedHighlights() {
		if (!selectedText || selectionStart === selectionEnd) return;

		const newHighlights: PositionHighlight[] = [];

		for (const h of highlights) {
			// Case 1: Highlight doesn't overlap with selection - keep as-is
			if (h.end <= selectionStart || h.start >= selectionEnd) {
				newHighlights.push(h);
				continue;
			}

			// Case 2: Selection completely covers highlight - remove it
			if (selectionStart <= h.start && selectionEnd >= h.end) {
				continue; // Skip this highlight
			}

			// Case 3: Selection overlaps start of highlight - keep the end part
			if (selectionStart <= h.start && selectionEnd < h.end) {
				newHighlights.push({
					...h,
					start: selectionEnd,
					text: sourceText.substring(selectionEnd, h.end)
				});
				continue;
			}

			// Case 4: Selection overlaps end of highlight - keep the start part
			if (selectionStart > h.start && selectionEnd >= h.end) {
				newHighlights.push({
					...h,
					end: selectionStart,
					text: sourceText.substring(h.start, selectionStart)
				});
				continue;
			}

			// Case 5: Selection is inside highlight - split into two highlights
			if (selectionStart > h.start && selectionEnd < h.end) {
				// Keep the part before selection
				newHighlights.push({
					...h,
					id: `${h.id}-before`,
					end: selectionStart,
					text: sourceText.substring(h.start, selectionStart)
				});
				// Keep the part after selection
				newHighlights.push({
					...h,
					id: `${h.id}-after`,
					start: selectionEnd,
					text: sourceText.substring(selectionEnd, h.end)
				});
			}
		}

		highlights = newHighlights;

		// Rebuild segments
		rebuildSegments();
	}

	function clearHighlights() {
		highlights = [];
		textSegments = [];
	}

	// Use the imported generateCardHtml from utils/citation
	async function handleCopy() {
		const html = generateCardHtml(citation, sourceText, textSegments, highlightConfig.levels);
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
						checked={citation.authorType === 'individual'}
						onchange={() => {
							citation.authorType = 'individual';
						}}
						name="authorType"
					/>
					Individual Authors
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						checked={citation.authorType === 'etal'}
						onchange={() => {
							citation.authorType = 'etal';
						}}
						name="authorType"
					/>
					One author + et al.
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						checked={citation.authorType === 'organization'}
						onchange={() => {
							citation.authorType = 'organization';
						}}
						name="authorType"
					/>
					Organization
				</label>
			</div>

			{#if citation.authorType === 'organization'}
				<div class="space-y-4">
					<div>
						<label class="mb-1 block font-semibold"
							>Organization Name<span class="text-red-500">*</span></label
						>
						<input
							type="text"
							bind:value={citation.organizationName}
							placeholder="RAND Corporation"
							class="w-full rounded border border-gray-300 px-3 py-2"
						/>
					</div>
					<div>
						<label class="mb-1 block font-semibold">Qualifications</label>
						<QualificationInput
							bind:value={citation.organizationQualifications}
							bind:boldArray={citation.organizationQualificationsBold}
							placeholder="Nonprofit global policy think tank"
						/>
					</div>
				</div>
			{:else if citation.authorType === 'etal'}
				<div class="space-y-4">
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
						<h3 class="mb-4 font-semibold">
							First Author
							{#if metadataWasAIExtracted}
								<span
									class="ml-2 inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-normal text-purple-700"
									title="Extracted using AI"
								>
									<Sparkles size={12} />
									AI
								</span>
							{/if}
						</h3>

						<div class="grid gap-4 md:grid-cols-2">
							<div>
								<label class="mb-1 block font-semibold">
									First Name<span class="text-red-500">*</span>
								</label>
								<input
									type="text"
									bind:value={citation.authors[0].firstName}
									placeholder="Michael"
									class="w-full rounded border border-gray-300 px-3 py-2"
								/>
							</div>

							<div>
								<label class="mb-1 block font-semibold">Last Name</label>
								<input
									type="text"
									bind:value={citation.authors[0].lastName}
									placeholder="Mazarr"
									class="w-full rounded border border-gray-300 px-3 py-2"
								/>
							</div>
						</div>

						<div class="mt-4">
							<label class="mb-1 block font-semibold">Qualifications</label>
							<QualificationInput
								bind:value={citation.authors[0].qualifications}
								bind:boldArray={citation.authors[0].qualificationsBold}
								placeholder="Senior Political Scientist at the RAND Corporation"
							/>
						</div>
					</div>
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
			oninput={handleTextInput}
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
				disabled={!sourceText ||
					(citation.authorType === 'organization'
						? !citation.organizationName
						: !citation.authors[0]?.firstName)}
			>
				{copySuccess ? 'Copied!' : 'Copy to Clipboard'}
			</button>
		</div>

		<div class="rounded border border-gray-200 bg-gray-50 p-4">
			{@html generateCardHtml(citation, sourceText, textSegments, highlightConfig.levels)}
		</div>
	</div>
</div>
