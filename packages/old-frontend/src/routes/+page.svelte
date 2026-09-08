<script lang="ts">
	import CardCutter from '$lib/components/CardCutter.svelte';
	import HighlightConfig from '$lib/components/HighlightConfig.svelte';
	import AISettings from '$lib/components/AISettings.svelte';
	import { Toaster } from 'svelte-sonner';
	import { Settings, Palette, HelpCircle } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import posthog from 'posthog-js';

	let showConfig = $state(false);
	let showAISettings = $state(false);

	async function startTour() {
		if (!browser) return;

		// Dynamic import to avoid SSR issues
		const introJs = (await import('intro.js')).default;
		const intro = introJs();

		intro.setOptions({
			steps: [
				{
					title: 'Welcome to Card Cutter! 👋',
					intro:
						"This tool helps you format debate evidence with proper citations and multi-level text highlighting. Let's take a quick tour!"
				},
				{
					element: document.querySelector('[data-intro="url-input"]') as HTMLElement,
					title: 'Start with a URL',
					intro:
						"Paste the article URL here. When you click away, we'll automatically extract metadata like title, author, publisher, and date."
				},
				{
					element: document.querySelector('[data-intro="ai-settings"]') as HTMLElement,
					title: 'AI-Powered Extraction',
					intro:
						"If automatic extraction can't find the author, you can configure AI extraction with your own API key (OpenAI, Anthropic, or Google)."
				},
				{
					element: document.querySelector('[data-intro="citation-fields"]') as HTMLElement,
					title: 'Citation Information',
					intro:
						'Review and edit the extracted citation information. All fields are editable, and you can add qualifications and your debate code.'
				},
				{
					element: document.querySelector('[data-intro="evidence-text"]') as HTMLElement,
					title: 'Paste Your Evidence',
					intro: 'Paste the text you want to cite here. Select any text to apply highlighting.'
				},
				{
					element: document.querySelector('[data-intro="highlight-buttons"]') as HTMLElement,
					title: 'Apply Highlights',
					intro:
						"Select text in the evidence area, then click a highlight level to apply formatting. You can apply multiple levels and they'll merge intelligently."
				},
				{
					element: document.querySelector('[data-intro="highlight-config"]') as HTMLElement,
					title: 'Customize Highlights',
					intro:
						'Click here to customize highlight levels - change colors, make text bold/underlined, adjust font sizes, or add new levels.'
				},
				{
					element: document.querySelector('[data-intro="preview"]') as HTMLElement,
					title: 'Preview & Copy',
					intro:
						'See how your formatted card will look. Click "Copy to Clipboard" to copy rich text that pastes perfectly into Word or Google Docs!'
				},
				{
					title: "You're All Set! 🎉",
					intro: 'Start by pasting an article URL, then highlight your evidence. Happy debating!'
				}
			],
			exitOnOverlayClick: false,
			showProgress: true,
			showBullets: false,
			disableInteraction: true
		});

		intro.start();
	}

	onMount(() => {
		// Check if this is the user's first visit
		if (browser && !localStorage.getItem('cardcutter_tour_completed')) {
			// Auto-start tour on first visit after a short delay
			setTimeout(() => {
				startTour();
				localStorage.setItem('cardcutter_tour_completed', 'true');
			}, 1000);
		}
		// Ensure flags are loaded before usage.
		// You'll only need to call this on the code for when the first time a user visits.
		posthog.onFeatureFlags(function () {
			// feature flags should be available at this point
			if (posthog.isFeatureEnabled('my-flag')) {
				// do something
				console.log('Feature flag enabled');
			}
		});
	});
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://cdn.jsdelivr.net/npm/intro.js@7.2.0/minified/introjs.min.css"
	/>
</svelte:head>

<Toaster richColors position="top-right" />

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
	<div class="container mx-auto px-4">
		<aside
			aria-labelledby="web-version-notice-title"
			class="mb-8 rounded-xl border border-indigo-200 bg-white/90 p-5 text-left shadow-sm"
		>
			<p class="mb-1 text-sm font-semibold tracking-wide text-indigo-700 uppercase">
				Web editor notice
			</p>
			<h2 id="web-version-notice-title" class="text-xl font-bold text-gray-900">
				The web version is deprecated.
			</h2>
			<p class="mt-2 text-gray-700">
				Use the Card Cutter extension for citations from the page you’re reading. You can still use
				this web editor.
			</p>

			<details class="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/70 px-4 py-3">
				<summary class="cursor-pointer font-semibold text-indigo-800 hover:text-indigo-900">
					Learn more
				</summary>
				<div class="mt-3 space-y-4 text-sm leading-6 text-gray-700">
					<p>
						Download the extension from the
						<a
							href="https://github.com/ThatXliner/cardcutter/releases/latest"
							target="_blank"
							rel="noreferrer"
							class="font-semibold text-indigo-700 underline hover:text-indigo-900"
						>
							latest release
						</a>.
					</p>

					<div>
						<h3 class="font-semibold text-gray-900">Chrome and Edge</h3>
						<p>
							Download the <code class="rounded bg-white px-1 py-0.5 font-mono text-xs">chrome</code
							>
							ZIP from the release (not the GitHub source archive), unzip it, and open
							<code class="rounded bg-white px-1 py-0.5 font-mono text-xs">chrome://extensions</code
							>
							or
							<code class="rounded bg-white px-1 py-0.5 font-mono text-xs">edge://extensions</code>.
							Turn on Developer mode, choose Load unpacked, and select the unzipped folder
							containing
							<code class="rounded bg-white px-1 py-0.5 font-mono text-xs">manifest.json</code>.
						</p>
					</div>

					<div>
						<h3 class="font-semibold text-gray-900">Firefox 154+</h3>
						<p>
							Download the <code class="rounded bg-white px-1 py-0.5 font-mono text-xs"
								>firefox</code
							>
							ZIP from the release, unzip it, and open
							<code class="rounded bg-white px-1 py-0.5 font-mono text-xs"
								>about:debugging#/runtime/this-firefox</code
							>. Choose Load Temporary Add-on and select
							<code class="rounded bg-white px-1 py-0.5 font-mono text-xs">manifest.json</code>.
							Unsigned temporary installations are removed when Firefox restarts.
						</p>
					</div>

					<p>
						Open the article you want to cite, then click the Card Cutter toolbar icon. The popup
						can be expanded into a new tab.
					</p>
				</div>
			</details>
		</aside>

		<div class="mb-8 text-center">
			<h1 class="mb-2 text-4xl font-bold text-gray-900">NSDA Debate Card Cutter</h1>
			<p class="text-gray-600">
				Automatically format debate evidence with citations and highlights
			</p>

			<div class="mt-4 flex justify-center gap-3">
				<button
					data-intro="highlight-config"
					onclick={() => (showConfig = true)}
					class="inline-flex items-center gap-2 rounded bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
				>
					<Palette size={20} />
					Configure Highlight Levels
				</button>

				<button
					data-intro="ai-settings"
					onclick={() => (showAISettings = true)}
					class="inline-flex items-center gap-2 rounded bg-purple-600 px-6 py-2 text-white hover:bg-purple-700"
				>
					<Settings size={20} />
					AI Settings
				</button>

				<button
					onclick={startTour}
					class="inline-flex items-center gap-2 rounded bg-gray-600 px-6 py-2 text-white hover:bg-gray-700"
					title="Take a guided tour"
				>
					<HelpCircle size={20} />
					Take Tour
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
