import type { AIConfig, AIProvider } from '../types';
import { getStorageAdapter } from '../utils/storage';

const STORAGE_KEY = 'cardcutter_ai_config';

// Simple obfuscation (not secure encryption, just prevents casual viewing)
function obfuscate(text: string): string {
	return btoa(text.split('').reverse().join(''));
}

function deobfuscate(text: string): string {
	try {
		return atob(text).split('').reverse().join('');
	} catch {
		return '';
	}
}

const DEFAULT_CONFIG: AIConfig = {
	provider: 'none',
	apiKey: '',
	model: ''
};

async function getAIConfig(): Promise<AIConfig> {
	try {
		const adapter = getStorageAdapter();
		const stored = await adapter.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Deobfuscate API key
			if (parsed.apiKey) {
				parsed.apiKey = deobfuscate(parsed.apiKey);
			}
			return parsed;
		}
	} catch (error) {
		console.error('Failed to load AI config:', error);
	}
	return DEFAULT_CONFIG;
}

async function saveAIConfig(config: AIConfig) {
	try {
		const adapter = getStorageAdapter();
		// Obfuscate API key before saving
		const toSave = {
			...config,
			apiKey: config.apiKey ? obfuscate(config.apiKey) : ''
		};
		await adapter.setItem(STORAGE_KEY, JSON.stringify(toSave));
	} catch (error) {
		console.error('Failed to save AI config:', error);
	}
}

class AIConfigStore {
	config = $state<AIConfig>(DEFAULT_CONFIG);
	private initialized = false;

	async init() {
		if (this.initialized) return;
		this.config = await getAIConfig();
		this.initialized = true;
	}

	get isConfigured(): boolean {
		return this.config.provider !== 'none' && this.config.apiKey.length > 0;
	}

	updateConfig(updates: Partial<AIConfig>) {
		this.config = { ...this.config, ...updates };
		saveAIConfig(this.config);
	}

	setProvider(provider: AIProvider) {
		this.config = { ...this.config, provider };
		saveAIConfig(this.config);
	}

	setApiKey(apiKey: string) {
		this.config = { ...this.config, apiKey };
		saveAIConfig(this.config);
	}

	setModel(model: string) {
		this.config = { ...this.config, model };
		saveAIConfig(this.config);
	}

	async clearConfig() {
		this.config = DEFAULT_CONFIG;
		try {
			const adapter = getStorageAdapter();
			await adapter.removeItem(STORAGE_KEY);
		} catch (error) {
			console.error('Failed to clear AI config:', error);
		}
	}
}

export const aiConfig = new AIConfigStore();
