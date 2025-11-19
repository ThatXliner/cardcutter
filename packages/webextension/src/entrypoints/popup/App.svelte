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

	// Initialize stores and get current tab URL on mount
	onMount(async () => {
		// Set up browser storage adapter
		setStorageAdapter(browserStorageAdapter);

		// Initialize stores
		await highlightConfig.init();
		await aiConfig.init();
		storesInitialized = true;

		// Get current tab URL
		try {
			const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
			if (tab?.url) {
				initialUrl = tab.url;
			}
		} catch (error) {
			console.error('Failed to get current tab:', error);
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

{#if storesInitialized}
	<div class="h-screen overflow-auto bg-gray-50 p-4">
		<div class="mb-4 flex items-center justify-between">
			<h1 class="text-2xl font-bold">Card Cutter</h1>
			<div class="flex gap-2">
				<button
					onclick={() => (showAISettings = true)}
					class="rounded bg-purple-600 p-2 text-white hover:bg-purple-700"
					title="AI Settings"
				>
					<Settings size={20} />
				</button>
				<button
					onclick={() => (showHighlightConfig = true)}
					class="rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
					title="Highlight Configuration"
				>
					<Palette size={20} />
				</button>
			</div>
		</div>

		<CardCutter {extractMetadata} {initialUrl} />

		<HighlightConfig bind:open={showHighlightConfig} />
		<AISettings bind:open={showAISettings} />
	</div>
{:else}
	<div class="flex h-screen items-center justify-center">
		<p class="text-gray-600">Loading...</p>
	</div>
{/if}
