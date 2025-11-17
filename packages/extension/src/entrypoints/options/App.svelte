<script lang="ts">
  import "../app.css";
  import HighlightConfig from "../../lib/components/HighlightConfig.svelte";
  import AISettings from "../../lib/components/AISettings.svelte";

  let showHighlightConfig = $state(true);
  let showAISettings = $state(true);
</script>

<div class="min-h-screen bg-gray-50 p-8">
  <div class="mx-auto max-w-4xl">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">
        NSDA Card Cutter - Settings
      </h1>
      <p class="mt-2 text-gray-600">
        Configure highlight levels and AI extraction settings
      </p>
    </header>

    <main class="space-y-6">
      <!-- Highlight Configuration -->
      <HighlightConfig bind:open={showHighlightConfig} />

      <!-- AI Settings -->
      <AISettings bind:open={showAISettings} />
    </main>
  </div>
</div>
