<script lang="ts">
    import { onMount } from "svelte";
    import CardCutter from "@acme/shared/components/CardCutter.svelte";
    import HighlightConfig from "@acme/shared/components/HighlightConfig.svelte";
    import AISettings from "@acme/shared/components/AISettings.svelte";
    import {
        setStorageAdapter,
        browserStorageAdapter,
    } from "@acme/shared/utils/storage";
    import { highlightConfig } from "@acme/shared/stores/highlightConfig";
    import { aiConfig } from "@acme/shared/stores/aiConfig";
    import { extractMetadataWithZotero } from "~/lib/zoteroExtractor";
    import {
        mapZoteroItemToExtractedMetadata,
        isZoteroExtractionSuccessful,
    } from "~/lib/zoteroMapper";
    import { extractAuthorQualificationsWithAI } from "@acme/shared/utils/aiMetadataExtractor";
    import type { ExtractedMetadata } from "@acme/shared/types";
    import { Toaster } from "svelte-sonner";
    import { Settings, Palette, Download } from "lucide-svelte";

    let initialUrl = $state("");
    let showHighlightConfig = $state(false);
    let showAISettings = $state(false);
    let storesInitialized = $state(false);
    let initError = $state<string | null>(null);
    let cardCutterRef: any = $state(null);

    // Initialize stores and get current tab URL on mount
    onMount(async () => {
        try {
            console.log("Starting initialization...");
            console.log("browser available?", typeof browser !== "undefined");
            console.log(
                "browser.storage available?",
                typeof browser !== "undefined" && browser.storage,
            );

            // Set up browser storage adapter
            setStorageAdapter(browserStorageAdapter);
            console.log("Storage adapter set");

            // Initialize stores
            await highlightConfig.init();
            console.log("Highlight config initialized");

            await aiConfig.init();
            console.log("AI config initialized");

            storesInitialized = true;
            console.log("Stores initialized successfully");

            // Get current tab URL
            try {
                const [tab] = await browser.tabs.query({
                    active: true,
                    currentWindow: true,
                });
                if (tab?.url) {
                    initialUrl = tab.url;
                    console.log("Got tab URL:", initialUrl);
                }
            } catch (error) {
                console.error("Failed to get current tab:", error);
            }
        } catch (error) {
            console.error("Initialization failed:", error);
            initError =
                error instanceof Error ? error.message : "Unknown error";
        }
    });

    // Metadata extraction function using Zotero translators
    async function extractMetadata(url: string): Promise<ExtractedMetadata> {
        try {
            let html = "";
            let actualUrl = url;

            // Get active tab
            const [tab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
            });

            // If the URL matches the current tab, get HTML from the page directly
            if (tab && tab.url === url && tab.id) {
                try {
                    // Send message to content script to get page data
                    const response = await browser.tabs.sendMessage(tab.id, {
                        type: "EXTRACT_METADATA",
                    });

                    if (response) {
                        html = response.html || "";
                        actualUrl = response.url || url;
                    }
                } catch (error) {
                    console.error("Failed to get page content from content script:", error);
                    throw new Error("Could not get page content. Make sure you're on a web page (not a browser page like chrome:// or about:)");
                }
            } else {
                throw new Error("URL doesn't match current tab. Please navigate to the page you want to extract from.");
            }

            // Extract metadata using Zotero translators (via ztractor)
            console.log("Extracting metadata with ztractor...");
            const zoteroResult = await extractMetadataWithZotero(
                actualUrl,
                html,
            );

            if (zoteroResult.success && zoteroResult.items.length > 0) {
                const firstItem = zoteroResult.items[0];

                // Check if extraction was successful
                if (isZoteroExtractionSuccessful(firstItem)) {
                    console.log("Zotero extraction successful:", firstItem);

                    // Map Zotero item to ExtractedMetadata
                    let metadata = mapZoteroItemToExtractedMetadata(firstItem);

                    // Enhance with AI qualifications if configured
                    if (aiConfig.isConfigured && html) {
                        try {
                            // Extract author names for qualification search
                            const authorNames =
                                firstItem.creators
                                    ?.filter((c) => c.creatorType === "author")
                                    .map((c) => {
                                        if (c.name) return c.name;
                                        return `${c.firstName || ""} ${c.lastName || ""}`.trim();
                                    })
                                    .filter((name) => name) || [];

                            if (authorNames.length > 0) {
                                console.log(
                                    "Extracting qualifications with AI for:",
                                    authorNames,
                                );
                                const qualifications =
                                    await extractAuthorQualificationsWithAI(
                                        authorNames,
                                        actualUrl,
                                        html,
                                        aiConfig.config,
                                    );

                                if (qualifications) {
                                    metadata = {
                                        ...metadata,
                                        qualifications,
                                        aiExtracted: true,
                                    };
                                }
                            }
                        } catch (aiError) {
                            console.error(
                                "AI qualifications extraction failed:",
                                aiError,
                            );
                            // Continue without qualifications
                        }
                    }

                    return metadata;
                }
            }

            // If Zotero extraction failed, throw error
            console.error("Metadata extraction failed:", zoteroResult.error);
            throw new Error(
                zoteroResult.error ||
                    "Metadata extraction failed. No translator could extract data from this page.",
            );
        } catch (error) {
            console.error("Metadata extraction failed:", error);
            throw error;
        }
    }

    // Function to extract from current page
    async function extractFromCurrentPage() {
        try {
            const [tab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (tab?.url) {
                // Update the URL in CardCutter and trigger extraction
                if (cardCutterRef && cardCutterRef.extractFromUrl) {
                    await cardCutterRef.extractFromUrl(tab.url);
                }
            }
        } catch (error) {
            console.error("Failed to extract from current page:", error);
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
                <h1 class="mb-2 text-3xl font-bold text-gray-900">
                    NSDA Debate Card Cutter
                </h1>
                <p class="text-sm text-gray-600">
                    Automatically format debate evidence with citations and
                    highlights
                </p>

                <div class="mt-4 flex justify-center gap-3">
                    <button
                        onclick={extractFromCurrentPage}
                        class="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                    >
                        <Download size={18} />
                        Extract from Current Page
                    </button>

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
                <CardCutter
                    bind:this={cardCutterRef}
                    {extractMetadata}
                    {initialUrl}
                />
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
