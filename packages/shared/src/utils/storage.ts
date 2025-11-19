/**
 * Storage adapter that abstracts localStorage (web) vs browser.storage.local (extension)
 *
 * Usage:
 * - Web apps: Use setStorageAdapter(localStorageAdapter)
 * - Extensions: Use setStorageAdapter(browserStorageAdapter)
 */

export interface StorageAdapter {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
	removeItem(key: string): Promise<void>;
}

let currentAdapter: StorageAdapter | null = null;

export function setStorageAdapter(adapter: StorageAdapter) {
	currentAdapter = adapter;
}

export function getStorageAdapter(): StorageAdapter {
	if (!currentAdapter) {
		throw new Error('Storage adapter not set. Call setStorageAdapter() before using stores.');
	}
	return currentAdapter;
}

/**
 * LocalStorage adapter for web applications
 */
export const localStorageAdapter: StorageAdapter = {
	async getItem(key: string): Promise<string | null> {
		return localStorage.getItem(key);
	},
	async setItem(key: string, value: string): Promise<void> {
		localStorage.setItem(key, value);
	},
	async removeItem(key: string): Promise<void> {
		localStorage.removeItem(key);
	}
};

/**
 * Browser storage adapter for WebExtensions
 * Requires browser.storage API to be available
 *
 * Note: In WXT and other extension frameworks, 'browser' is globally available
 * through the webextension-polyfill. If it's not available, chrome.storage will be used.
 */
export const browserStorageAdapter: StorageAdapter = {
	async getItem(key: string): Promise<string | null> {
		// Check for browser API (Firefox/polyfill) or chrome API
		const storage = (typeof browser !== 'undefined' && browser.storage)
			? browser.storage
			: (typeof chrome !== 'undefined' && chrome.storage)
				? chrome.storage
				: null;

		if (!storage) {
			throw new Error('Neither browser.storage nor chrome.storage API is available');
		}

		// Use Promise-based API (browser) or callback-based API (chrome)
		if (typeof browser !== 'undefined' && browser.storage) {
			const result = await browser.storage.local.get(key);
			return result[key] ?? null;
		} else {
			// Chrome callback API wrapped in Promise
			return new Promise((resolve) => {
				chrome.storage.local.get(key, (result) => {
					resolve(result[key] ?? null);
				});
			});
		}
	},
	async setItem(key: string, value: string): Promise<void> {
		const storage = (typeof browser !== 'undefined' && browser.storage)
			? browser.storage
			: (typeof chrome !== 'undefined' && chrome.storage)
				? chrome.storage
				: null;

		if (!storage) {
			throw new Error('Neither browser.storage nor chrome.storage API is available');
		}

		if (typeof browser !== 'undefined' && browser.storage) {
			await browser.storage.local.set({ [key]: value });
		} else {
			return new Promise((resolve) => {
				chrome.storage.local.set({ [key]: value }, () => resolve());
			});
		}
	},
	async removeItem(key: string): Promise<void> {
		const storage = (typeof browser !== 'undefined' && browser.storage)
			? browser.storage
			: (typeof chrome !== 'undefined' && chrome.storage)
				? chrome.storage
				: null;

		if (!storage) {
			throw new Error('Neither browser.storage nor chrome.storage API is available');
		}

		if (typeof browser !== 'undefined' && browser.storage) {
			await browser.storage.local.remove(key);
		} else {
			return new Promise((resolve) => {
				chrome.storage.local.remove(key, () => resolve());
			});
		}
	}
};
