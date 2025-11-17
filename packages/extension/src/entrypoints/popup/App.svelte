<script lang="ts">
  import "../app.css";
  import CardCutter from "../../lib/components/CardCutter.svelte";
  import { Settings } from "lucide-svelte";

  function openOptions() {
    browser.runtime.openOptionsPage();
  }
</script>

<div class="w-[600px] min-h-[700px] bg-gray-50">
  <header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
    <h1 class="text-lg font-bold text-gray-900">NSDA Card Cutter</h1>
    <button
      onclick={openOptions}
      class="rounded p-2 text-gray-600 hover:bg-gray-200"
      title="Settings"
    >
      <Settings size={20} />
    </button>
  </header>

  <main class="p-4">
    <CardCutter />
  </main>
</div>
