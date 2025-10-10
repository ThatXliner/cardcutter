<script lang="ts">
	import CardCutter from '$lib/components/CardCutter.svelte';
	import HighlightConfig from '$lib/components/HighlightConfig.svelte';
	import AISettings from '$lib/components/AISettings.svelte';
	import { Toaster } from 'svelte-sonner';
	import { Settings, Palette } from 'lucide-svelte';

	let showConfig = $state(false);
	let showAISettings = $state(false);
</script>

<Toaster richColors position="top-right" />

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
	<div class="container mx-auto px-4">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-4xl font-bold text-gray-900">NSDA Debate Card Cutter</h1>
			<p class="text-gray-600">Automatically format debate evidence with citations and highlights</p>

			<div class="mt-4 flex justify-center gap-3">
				<button
					onclick={() => (showConfig = true)}
					class="inline-flex items-center gap-2 rounded bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
				>
					<Palette size={20} />
					Configure Highlight Levels
				</button>

				<button
					onclick={() => (showAISettings = true)}
					class="inline-flex items-center gap-2 rounded bg-purple-600 px-6 py-2 text-white hover:bg-purple-700"
				>
					<Settings size={20} />
					AI Settings
				</button>
			</div>
		</div>

		<div class="mx-auto max-w-5xl">
			<CardCutter />
		</div>
	</div>
</div>

<HighlightConfig bind:open={showConfig} />
<AISettings bind:open={showAISettings} />
