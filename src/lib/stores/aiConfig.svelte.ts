import type { AIConfig, AIProvider } from '$lib/types';

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

function getAIConfig(): AIConfig {
	if (typeof window === 'undefined') return DEFAULT_CONFIG;

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			// Deobfuscate API key
			if (parsed.apiKey) {
				parsed.apiKey = deobfuscate(parsed.apiKey);
			}
			return parsed;
		} catch {
			return DEFAULT_CONFIG;
		}
	}
	return DEFAULT_CONFIG;
}

function saveAIConfig(config: AIConfig) {
	if (typeof window === 'undefined') return;

	// Obfuscate API key before saving
	const toSave = {
		...config,
		apiKey: config.apiKey ? obfuscate(config.apiKey) : ''
	};

	localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

class AIConfigStore {
	config = $state<AIConfig>(getAIConfig());

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

	clearConfig() {
		this.config = DEFAULT_CONFIG;
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

export const aiConfig = new AIConfigStore();
