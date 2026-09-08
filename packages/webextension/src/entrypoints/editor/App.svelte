<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from 'wxt/browser';
	import { Palette } from 'lucide-svelte';
	import CardCutter from '@acme/shared/components/CardCutter.svelte';
	import HighlightConfig from '@acme/shared/components/HighlightConfig.svelte';
	import type { CardDraftState, CitationData, ExtractedMetadata } from '@acme/shared/types';
	import { editorUrl, loadCapture, type Capture } from '../../lib/capture';
	import { extractCapture } from '../../lib/extraction';

	type Draft = {
		version: 2;
		id: string;
		title: string;
		updatedAt: string;
		state: CardDraftState;
		sourceUrl: string;
		originalSourceText: string;
		raw: string;
		diagnostics: string[];
		translator: string;
	};

	const params = new URL(location.href).searchParams;
	const id = params.get('id') || '';
	const initialError = params.get('error') || '';
	const isPopup = params.get('popup') === '1';
	const draftKey = `draft:${id}`;
	let capture = $state<Capture>();
	let draft = $state<Draft>();
	let ready = $state(false);
	let showConfig = $state(false);
	let saveStatus = $state('');
	let recent = $state<Draft[]>([]);
	let diagnostics = $state<string[]>([]);
	let raw = $state('');
	let translator = $state('');
	let sourceUrl = $state('');
	let initializationError = $state('');
	let shouldAutoExtract = $state(false);
	let isOpeningInNewTab = $state(false);
	let openError = $state('');
	let saveSequence = 0;
	let pendingSave: Promise<void> = Promise.resolve();
	let pendingMetadataExtraction: Promise<ExtractedMetadata> | undefined;

	const blankCitation = (page?: Capture): CitationData => ({
		authorType: 'individual',
		organizationName: '',
		organizationQualifications: '',
		organizationQualificationsBold: [],
		authors: [{ firstName: '', lastName: '', qualifications: '', qualificationsBold: [] }],
		date: '',
		articleTitle: page?.title || '',
		source: '',
		url: page?.url || '',
		dateOfAccess: page ? new Date(page.capturedAt).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US'),
		code: '',
		pageNumber: ''
	});

	function initialState(page?: Capture): CardDraftState {
		return {
			citation: blankCitation(page),
			sourceText: page?.selection || page?.text || '',
			highlights: [],
			tag: '',
			error: page?.error || initialError || undefined
		};
	}

	function toMetadata(result: Awaited<ReturnType<typeof extractCapture>>): ExtractedMetadata {
		const items = result.items || [];
		const item = items[0];
		if (!result.success || !item || items.length !== 1) {
			throw new Error(result.error || 'No single article citation was found. Review the source fields below.');
		}
		return {
			title: item.title || '',
			date: item.date || '',
			publisher: item.publicationTitle || item.publisher || item.blogTitle || item.websiteTitle || item.encyclopediaTitle || '',
			creators: (item.creators || []).filter((creator) => !creator.creatorType || creator.creatorType === 'author').map((creator) => ({
				creatorType: creator.creatorType,
				firstName: creator.firstName,
				lastName: creator.lastName,
				name: creator.name,
				fieldMode: creator.fieldMode
			}))
		};
	}

	async function extractMetadata(url: string): Promise<ExtractedMetadata> {
		const extraction = (async () => {
			if (!capture || url !== capture.url) {
				throw new Error('Card Cutter only extracts from the captured page URL. Reopen the page and capture it again to use another URL.');
			}
			const result = await extractCapture(capture);
			diagnostics = (result.diagnostics || []).map((entry) => `${entry.translator}: ${entry.message}`);
			raw = JSON.stringify(result, null, 2);
			translator = result.translator || 'Zotero';
			return toMetadata(result);
		})();

		pendingMetadataExtraction = extraction;
		try {
			return await extraction;
		} finally {
			if (pendingMetadataExtraction === extraction) pendingMetadataExtraction = undefined;
		}
	}

	async function listDrafts() {
		const values = await browser.storage.local.get(null);
		recent = Object.values(values)
			.filter((value): value is Draft => Boolean(value && typeof value === 'object' && (value as Draft).version === 2))
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
	}

	function saveState(state: CardDraftState) {
		if (!id) return;
		const next: Draft = {
			version: 2,
			id,
			title: state.citation.articleTitle || 'Untitled card',
			updatedAt: new Date().toISOString(),
			state,
			sourceUrl,
			originalSourceText: draft?.originalSourceText || initialState(capture).sourceText,
			raw,
			diagnostics,
			translator
		};
		draft = next;
		const sequence = ++saveSequence;
		saveStatus = 'Saving…';
		const snapshot = $state.snapshot(next);
		const write = pendingSave.catch(() => undefined).then(async () => {
			await browser.storage.local.set({ [draftKey]: snapshot });
		});
		pendingSave = write;
		void write.then(() => {
			if (sequence === saveSequence) saveStatus = 'Saved on this device';
		}).catch(() => {
			if (sequence === saveSequence) saveStatus = 'Could not save this card. Copy it now or delete unused saved cards to free space.';
		});
	}

	async function waitForLatestDraftSave(): Promise<void> {
		while (true) {
			const save = pendingSave;
			await save;
			await tick();
			if (save === pendingSave) return;
		}
	}

	async function openInNewTab() {
		if (!isPopup || !id || isOpeningInNewTab) return;

		isOpeningInNewTab = true;
		openError = '';
		try {
			const extraction = pendingMetadataExtraction;
			if (extraction) await extraction.catch(() => undefined);
			await tick();
			await waitForLatestDraftSave();
			await browser.tabs.create({ url: editorUrl(id, initialError || capture?.error) });
			window.close();
		} catch (error) {
			openError = `Could not open this card in a new tab: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			isOpeningInNewTab = false;
		}
	}

	function draftUrl(draftId: string): string {
		const query = new URLSearchParams({ id: draftId });
		if (isPopup) query.set('popup', '1');
		return `editor.html?${query}`;
	}

	async function deleteDraft() {
		if (!id || !window.confirm('Delete this saved card from this device? This cannot be undone.')) return;
		try {
			await waitForLatestDraftSave().catch(() => undefined);
			await browser.storage.local.remove(draftKey);
			location.assign(isPopup ? draftUrl('') : browser.runtime.getURL('/editor.html'));
		} catch {
			saveStatus = 'Could not delete this saved card.';
		}
	}

	onMount(() => {
		void (async () => {
			try {
				await listDrafts();
				if (!id) { ready = true; return; }
				capture = await loadCapture(id);
				const stored = (await browser.storage.local.get(draftKey))[draftKey] as Draft | undefined;
				if (stored?.version === 2) {
					draft = stored;
					sourceUrl = stored.sourceUrl;
					raw = stored.raw;
					diagnostics = stored.diagnostics;
					translator = stored.translator;
					ready = true;
					return;
				}
				if (!capture) {
					draft = { version: 2, id, title: 'Capture error', updatedAt: new Date().toISOString(), state: { ...initialState(), error: initialError || 'This page capture has expired. Open the article and click Card Cutter again.' }, sourceUrl: '', originalSourceText: '', raw: '', diagnostics: [], translator: '' };
					ready = true;
					return;
				}
				sourceUrl = capture.url;
				draft = { version: 2, id, title: capture.title || 'Untitled card', updatedAt: new Date().toISOString(), state: initialState(capture), sourceUrl: capture.url, originalSourceText: capture.selection || capture.text, raw: '', diagnostics: [], translator: '' };
				shouldAutoExtract = !capture.error;
			} catch (cause) {
				initializationError = `Could not open this card: ${cause instanceof Error ? cause.message : String(cause)}. Reload this page, or open the article and click Card Cutter again.`;
			} finally {
				ready = true;
			}
		})();
	});
</script>

<svelte:head><title>Card Cutter</title></svelte:head>


{#if isPopup}
	<div class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-indigo-100 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
		<span class="text-sm font-semibold text-gray-700">Card Cutter</span>
		<button
			onclick={openInNewTab}
			disabled={!ready || !id || isOpeningInNewTab}
			class="shrink-0 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
			type="button"
		>
			{isOpeningInNewTab ? 'Opening…' : 'Open in new tab'}
		</button>
		{#if openError}<span class="min-w-0 flex-1 text-right text-sm text-red-700" role="alert">{openError}</span>{/if}
	</div>
{/if}

<div class={isPopup ? 'min-h-[600px] bg-gradient-to-br from-blue-50 to-indigo-100 py-2' : 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8'}>
	<div class={isPopup ? 'container mx-auto px-3' : 'container mx-auto px-4'}>
		<div class={isPopup ? 'mb-3 text-center' : 'mb-8 text-center'}>
			<h1 class={isPopup ? 'mb-1 text-2xl font-bold text-gray-900' : 'mb-2 text-4xl font-bold text-gray-900'}>NSDA Debate Card Cutter</h1>
			<p class="text-gray-600">Automatically format debate evidence with citations and highlights</p>
			<div class={isPopup ? 'mt-2 flex justify-center gap-3' : 'mt-4 flex justify-center gap-3'}>
				<button data-intro="highlight-config" onclick={() => (showConfig = true)} class="inline-flex items-center gap-2 rounded bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"><Palette size={20} />Configure Highlight Levels</button>
			</div>
			<div class="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-600">
				{#if id}<button onclick={deleteDraft} class="underline hover:text-gray-900">Delete saved card</button>{/if}
				<details ontoggle={(event) => { if (event.currentTarget.open) void listDrafts(); }}><summary class="cursor-pointer underline">Saved cards ({recent.length})</summary><div class="mt-2 rounded bg-white p-3 text-left shadow">{#each recent as item}<a class="block py-1 hover:underline" href={draftUrl(item.id)}>{item.title}</a>{:else}<span>No saved cards yet.</span>{/each}</div></details>
				{#if saveStatus}<span role="status">{saveStatus}</span>{/if}
			</div>
		</div>
		<div class="mx-auto max-w-5xl">
			{#if !ready}<p class="text-center text-gray-600">Opening your page…</p>
			{:else if initializationError}<div class="rounded bg-white p-6 text-center text-red-700 shadow-sm" role="alert"><p>{initializationError}</p><button onclick={() => location.reload()} class="mt-4 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Reload editor</button></div>
			{:else if !id}<p class="rounded bg-white p-6 text-center text-gray-700 shadow-sm">Open an article, then click Card Cutter in the browser toolbar to create a card.</p>
			{:else if draft}<CardCutter initialState={draft.state} initialUrl={sourceUrl} extractMetadata={extractMetadata} autoExtract={shouldAutoExtract} onStateChange={saveState} />
				{#if translator || diagnostics.length || raw}<details class="mt-6 rounded-lg border border-gray-300 bg-white p-4 shadow-sm"><summary class="cursor-pointer font-semibold">Citation extraction details</summary><p class="mt-3 text-sm text-gray-600">Source: {translator || 'Page capture'}{sourceUrl ? ` · ${sourceUrl}` : ''}</p>{#if diagnostics.length}<ul class="mt-2 list-disc pl-5 text-sm text-gray-600">{#each diagnostics as detail}<li>{detail}</li>{/each}</ul>{/if}{#if raw}<pre class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">{raw}</pre>{/if}</details>{/if}
			{/if}
		</div>
	</div>
</div>

<HighlightConfig bind:open={showConfig} />
