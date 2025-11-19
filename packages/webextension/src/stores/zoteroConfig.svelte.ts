/**
 * Zotero Configuration Store
 *
 * Manages configuration for Zotero translation-server integration.
 * Uses Svelte 5 runes for reactive state management.
 */

import type { ZoteroTranslationServerConfig } from '../lib/zoteroExtractor';

const STORAGE_KEY = 'cardcutter_zotero_config';

export interface ZoteroConfigState extends Partial<ZoteroTranslationServerConfig> {
  enabled: boolean;
  serverAvailable?: boolean;
  lastChecked?: number;
}

const DEFAULT_CONFIG: ZoteroConfigState = {
  enabled: true,
  endpoint: 'http://localhost:1969',
  timeout: 10000,
  serverAvailable: undefined,
  lastChecked: undefined,
};

/**
 * Zotero configuration store
 */
function createZoteroConfigStore() {
  let config = $state<ZoteroConfigState>(DEFAULT_CONFIG);
  let isLoaded = $state(false);

  /**
   * Load configuration from storage
   */
  async function load() {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as ZoteroConfigState | undefined;

      if (stored) {
        config = { ...DEFAULT_CONFIG, ...stored };
      }

      isLoaded = true;
    } catch (error) {
      console.error('Failed to load Zotero config:', error);
      isLoaded = true;
    }
  }

  /**
   * Save configuration to storage
   */
  async function save() {
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: config });
    } catch (error) {
      console.error('Failed to save Zotero config:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  async function update(updates: Partial<ZoteroConfigState>) {
    config = { ...config, ...updates };
    await save();
  }

  /**
   * Reset to default configuration
   */
  async function reset() {
    config = { ...DEFAULT_CONFIG };
    await save();
  }

  /**
   * Mark server as available/unavailable
   */
  async function setServerAvailability(available: boolean) {
    await update({
      serverAvailable: available,
      lastChecked: Date.now(),
    });
  }

  /**
   * Enable Zotero integration
   */
  async function enable() {
    await update({ enabled: true });
  }

  /**
   * Disable Zotero integration
   */
  async function disable() {
    await update({ enabled: false });
  }

  /**
   * Update translation-server endpoint
   */
  async function setEndpoint(endpoint: string) {
    await update({
      endpoint,
      serverAvailable: undefined, // Reset availability check
    });
  }

  /**
   * Update request timeout
   */
  async function setTimeout(timeout: number) {
    await update({ timeout });
  }

  // Auto-load on creation
  load();

  return {
    get config() {
      return config;
    },
    get isLoaded() {
      return isLoaded;
    },
    get enabled() {
      return config.enabled;
    },
    get endpoint() {
      return config.endpoint;
    },
    get timeout() {
      return config.timeout;
    },
    get serverAvailable() {
      return config.serverAvailable;
    },
    get lastChecked() {
      return config.lastChecked;
    },
    load,
    save,
    update,
    reset,
    setServerAvailability,
    enable,
    disable,
    setEndpoint,
    setTimeout,
  };
}

export const zoteroConfigStore = createZoteroConfigStore();
export type ZoteroConfigStore = ReturnType<typeof createZoteroConfigStore>;
