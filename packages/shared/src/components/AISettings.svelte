<script lang="ts">
	import { aiConfig } from '../stores/aiConfig.svelte';
	import type { AIProvider, AIModelOption } from '../types';
	import { Eye, EyeOff } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { open = $bindable(false) } = $props();

	let showApiKey = $state(false);
	let localProvider = $state(aiConfig.config.provider);
	let localApiKey = $state(aiConfig.config.apiKey);
	let localModel = $state(aiConfig.config.model);

	const providerOptions: { value: AIProvider; label: string }[] = [
		{ value: 'none', label: 'None (Disabled)' },
		{ value: 'openai', label: 'OpenAI' },
		{ value: 'anthropic', label: 'Anthropic (Claude)' },
		{ value: 'google', label: 'Google (Gemini)' }
	];

	const modelOptions: Record<AIProvider, AIModelOption[]> = {
		none: [],
		openai: [
			{ value: 'gpt-4o', label: 'GPT-4o' },
			{ value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
			{ value: 'o3-mini', label: 'o3-mini' }
		],
		anthropic: [
			{ value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
			{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' }
		],
		google: [
			{ value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
			{ value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
		]
	};

	// Update local state when modal opens
	$effect(() => {
		if (open) {
			localProvider = aiConfig.config.provider;
			localApiKey = aiConfig.config.apiKey;
			localModel = aiConfig.config.model;
		}
	});

	// Auto-select default model when provider changes
	$effect(() => {
		if (localProvider !== 'none' && modelOptions[localProvider].length > 0) {
			if (!localModel || !modelOptions[localProvider].find((m) => m.value === localModel)) {
				localModel = modelOptions[localProvider][0].value;
			}
		}
	});

	function handleSave() {
		aiConfig.updateConfig({
			provider: localProvider,
			apiKey: localApiKey,
			model: localModel
		});

		toast.success('AI settings saved successfully');
		open = false;
	}

	function handleClear() {
		localProvider = 'none';
		localApiKey = '';
		localModel = '';
		aiConfig.clearConfig();
		toast.info('AI settings cleared');
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={() => (open = false)}
	>
		<div
			class="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold">AI Settings</h2>
				<button onclick={() => (open = false)} class="text-2xl hover:text-gray-600"
					>&times;</button
				>
			</div>

			<div class="mb-4 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
				<strong>⚠️ Security Notice:</strong> API keys are stored locally in your browser and sent
				directly to AI providers. Never share your API keys with others.
			</div>

			<div class="space-y-4">
				<!-- Provider Selection -->
				<div>
					<label class="mb-1 block font-semibold">AI Provider</label>
					<select
						bind:value={localProvider}
						class="w-full rounded border border-gray-300 px-3 py-2"
					>
						{#each providerOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				{#if localProvider !== 'none'}
					<!-- API Key Input -->
					<div>
						<label class="mb-1 block font-semibold">API Key</label>
						<div class="relative">
							<input
								type={showApiKey ? 'text' : 'password'}
								bind:value={localApiKey}
								placeholder="Enter your API key"
								class="w-full rounded border border-gray-300 px-3 py-2 pr-10"
							/>
							<button
								type="button"
								onclick={() => (showApiKey = !showApiKey)}
								class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
							>
								{#if showApiKey}
									<EyeOff size={20} />
								{:else}
									<Eye size={20} />
								{/if}
							</button>
						</div>
						<p class="mt-1 text-xs text-gray-600">
							{#if localProvider === 'openai'}
								Get your API key from <a
									href="https://platform.openai.com/api-keys"
									target="_blank"
									class="text-blue-600 underline">platform.openai.com</a>
							{:else if localProvider === 'anthropic'}
								Get your API key from <a
									href="https://console.anthropic.com/settings/keys"
									target="_blank"
									class="text-blue-600 underline">console.anthropic.com</a>
							{:else if localProvider === 'google'}
								Get your API key from <a
									href="https://aistudio.google.com/apikey"
									target="_blank"
									class="text-blue-600 underline">aistudio.google.com</a>
							{/if}
						</p>
					</div>

					<!-- Model Selection -->
					<div>
						<label class="mb-1 block font-semibold">Model</label>
						<select bind:value={localModel} class="w-full rounded border border-gray-300 px-3 py-2">
							{#each modelOptions[localProvider] as model}
								<option value={model.value}>{model.label}</option>
							{/each}
						</select>
					</div>

					<!-- Usage Info -->
					<div class="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
						<strong>ℹ️ How it works:</strong> AI extraction will be used as a fallback when the automatic
						extraction cannot find article metadata (especially author information). You'll be notified
						when AI is used.
					</div>
				{/if}
			</div>

			<!-- Action Buttons -->
			<div class="mt-6 flex gap-2">
				<button
					onclick={handleSave}
					class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
					disabled={localProvider !== 'none' && !localApiKey}
				>
					Save Settings
				</button>
				<button
					onclick={handleClear}
					class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
				>
					Clear Settings
				</button>
				<button
					onclick={() => (open = false)}
					class="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
