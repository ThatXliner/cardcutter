<script lang="ts">
	import CardCutter from '$lib/components/CardCutter.svelte';
	import HighlightConfig from '$lib/components/HighlightConfig.svelte';

	let showConfig = $state(false);
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
	<div class="container mx-auto px-4">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-4xl font-bold text-gray-900">NSDA Debate Card Cutter</h1>
			<p class="text-gray-600">Automatically format debate evidence with citations and highlights</p>

			<button
				onclick={() => (showConfig = true)}
				class="mt-4 rounded bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
			>
				Configure Highlight Levels
			</button>
		</div>

		<div class="mx-auto max-w-5xl">
			<CardCutter />
		</div>
	</div>
</div>

<HighlightConfig bind:open={showConfig} />
