<script lang="ts">
	import { highlightConfig } from '$lib/stores/highlightConfig.svelte';

	let { open = $bindable(false) } = $props();
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => (open = false)}>
		<div class="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold">Highlight Level Configuration</h2>
				<button onclick={() => (open = false)} class="text-2xl hover:text-gray-600">&times;</button>
			</div>

			<div class="space-y-4">
				{#each highlightConfig.levels as level (level.id)}
					<div class="rounded border border-gray-300 p-4">
						<div class="mb-3 flex items-center justify-between">
							<input
								type="text"
								bind:value={level.name}
								onchange={() => highlightConfig.updateLevel(level.id, { name: level.name })}
								class="rounded border border-gray-300 px-2 py-1 font-semibold"
							/>
							<button
								onclick={() => highlightConfig.removeLevel(level.id)}
								class="text-red-600 hover:text-red-800"
							>
								Remove
							</button>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									checked={level.bold}
									onchange={(e) => highlightConfig.updateLevel(level.id, { bold: e.currentTarget.checked })}
								/>
								<span>Bold</span>
							</label>

							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									checked={level.underline}
									onchange={(e) => highlightConfig.updateLevel(level.id, { underline: e.currentTarget.checked })}
								/>
								<span>Underline</span>
							</label>

							<label class="flex flex-col gap-1">
								<span>Font Size (%)</span>
								<input
									type="number"
									value={level.fontSize}
									oninput={(e) => highlightConfig.updateLevel(level.id, { fontSize: parseInt(e.currentTarget.value) || 100 })}
									class="rounded border border-gray-300 px-2 py-1"
									min="50"
									max="200"
								/>
							</label>

							<label class="flex flex-col gap-1">
								<span>Text Color</span>
								<input
									type="color"
									value={level.color || '#000000'}
									oninput={(e) => highlightConfig.updateLevel(level.id, { color: e.currentTarget.value })}
									class="h-10 w-full rounded border border-gray-300"
								/>
							</label>

							<label class="flex flex-col gap-1">
								<span>Background Color</span>
								<input
									type="color"
									value={level.backgroundColor || '#ffffff'}
									oninput={(e) => highlightConfig.updateLevel(level.id, { backgroundColor: e.currentTarget.value })}
									class="h-10 w-full rounded border border-gray-300"
								/>
							</label>

							<div class="flex flex-col gap-1">
								<span>Preview</span>
								<div
									class="rounded border border-gray-300 px-2 py-1"
									style="
										font-weight: {level.bold ? 'bold' : 'normal'};
										text-decoration: {level.underline ? 'underline' : 'none'};
										font-size: {level.fontSize}%;
										color: {level.color || 'black'};
										background-color: {level.backgroundColor || 'white'};
									"
								>
									Sample Text
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-4 flex gap-2">
				<button
					onclick={() => highlightConfig.addLevel()}
					class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					Add Level
				</button>
				<button
					onclick={() => highlightConfig.resetToDefaults()}
					class="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
				>
					Reset to Defaults
				</button>
			</div>
		</div>
	</div>
{/if}
