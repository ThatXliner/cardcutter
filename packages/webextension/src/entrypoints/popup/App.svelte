<script lang="ts">
	import { onMount } from 'svelte';
	import CardCutter from '@acme/shared/components/CardCutter.svelte';
	import HighlightConfig from '@acme/shared/components/HighlightConfig.svelte';
	import AISettings from '@acme/shared/components/AISettings.svelte';
	import { setStorageAdapter, browserStorageAdapter } from '@acme/shared/utils/storage';
	import { highlightConfig } from '@acme/shared/stores/highlightConfig';
	import { aiConfig } from '@acme/shared/stores/aiConfig';
	import { extractMetadataFromHtml } from '@acme/shared/utils/metadataExtractor';
	import { extractMetadataWithAI } from '@acme/shared/utils/aiMetadataExtractor';
	import type { ExtractedMetadata } from '@acme/shared/types';
	import { Toaster } from 'svelte-sonner';
	import { Settings, Palette } from 'lucide-svelte';

	let initialUrl = $state('');
	let showHighlightConfig = $state(false);
	let showAISettings = $state(false);
	let storesInitialized = $state(false);
	let initError = $state<string | null>(null);

	// Initialize stores and get current tab URL on mount
	onMount(async () => {
		try {
			console.log('Starting initialization...');
			console.log('browser available?', typeof browser !== 'undefined');
			console.log('browser.storage available?', typeof browser !== 'undefined' && browser.storage);

			// Set up browser storage adapter
			setStorageAdapter(browserStorageAdapter);
			console.log('Storage adapter set');

			// Initialize stores
			await highlightConfig.init();
			console.log('Highlight config initialized');

			await aiConfig.init();
			console.log('AI config initialized');

			storesInitialized = true;
			console.log('Stores initialized successfully');

			// Get current tab URL
			try {
				const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
				if (tab?.url) {
					initialUrl = tab.url;
					console.log('Got tab URL:', initialUrl);
				}
			} catch (error) {
				console.error('Failed to get current tab:', error);
			}
		} catch (error) {
			console.error('Initialization failed:', error);
			initError = error instanceof Error ? error.message : 'Unknown error';
		}
	});

	// Metadata extraction function for the extension
	async function extractMetadata(url: string): Promise<ExtractedMetadata> {
		try {
			// Get active tab
			const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

			// If the URL matches the current tab, extract from the page directly
			if (tab && tab.url === url && tab.id) {
				// Send message to content script to extract metadata
				const response = await browser.tabs.sendMessage(tab.id, {
					type: 'EXTRACT_METADATA'
				});

				if (response && response.metadata) {
					// If author is missing and AI is configured, try AI extraction
					if (!response.metadata.author && aiConfig.isConfigured) {
						try {
							const aiMetadata = await extractMetadataWithAI(url, response.html || '', aiConfig.config);
							return aiMetadata;
						} catch (aiError) {
							console.error('AI extraction failed:', aiError);
							return response.metadata;
						}
					}
					return response.metadata;
				}
			}

			// Fallback: fetch URL and extract metadata
			const response = await fetch(url);
			const html = await response.text();
			const metadata = extractMetadataFromHtml(html, url);

			// Try AI extraction if author is missing and AI is configured
			if (!metadata.author && aiConfig.isConfigured) {
				try {
					const aiMetadata = await extractMetadataWithAI(url, html, aiConfig.config);
					return aiMetadata;
				} catch (aiError) {
					console.error('AI extraction failed:', aiError);
					return metadata;
				}
			}

			return metadata;
		} catch (error) {
			console.error('Metadata extraction failed:', error);
			throw error;
		}
	}
</script>

<Toaster />

{#if initError}
	<div class="flex h-screen items-center justify-center p-4">
		<div class="text-center">
			<p class="text-red-600 font-semibold">Initialization Error:</p>
			<p class="text-gray-600 mt-2">{initError}</p>
		</div>
	</div>
{:else if storesInitialized}
	<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6">
		<div class="container mx-auto px-4">
			<div class="mb-6 text-center">
				<h1 class="mb-2 text-3xl font-bold text-gray-900">NSDA Debate Card Cutter</h1>
				<p class="text-sm text-gray-600">
					Automatically format debate evidence with citations and highlights
				</p>

				<div class="mt-4 flex justify-center gap-3">
					<button
						onclick={() => (showHighlightConfig = true)}
						class="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
					>
						<Palette size={18} />
						Configure Highlight Levels
					</button>

					<button
						onclick={() => (showAISettings = true)}
						class="inline-flex items-center gap-2 rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
					>
						<Settings size={18} />
						AI Settings
					</button>
				</div>
			</div>

			<div class="mx-auto max-w-4xl">
				<CardCutter {extractMetadata} {initialUrl} />
			</div>
		</div>
	</div>

	<HighlightConfig bind:open={showHighlightConfig} />
	<AISettings bind:open={showAISettings} />
{:else}
	<div class="flex h-screen items-center justify-center">
		<p class="text-gray-600">Loading...</p>
	</div>
{/if}
