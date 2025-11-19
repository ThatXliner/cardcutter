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
 */
export const browserStorageAdapter: StorageAdapter = {
	async getItem(key: string): Promise<string | null> {
		if (typeof browser === 'undefined' || !browser.storage) {
			throw new Error('browser.storage API not available');
		}
		const result = await browser.storage.local.get(key);
		return result[key] ?? null;
	},
	async setItem(key: string, value: string): Promise<void> {
		if (typeof browser === 'undefined' || !browser.storage) {
			throw new Error('browser.storage API not available');
		}
		await browser.storage.local.set({ [key]: value });
	},
	async removeItem(key: string): Promise<void> {
		if (typeof browser === 'undefined' || !browser.storage) {
			throw new Error('browser.storage API not available');
		}
		await browser.storage.local.remove(key);
	}
};
