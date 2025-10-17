import type { ExaConfig } from '$lib/types';

const STORAGE_KEY = 'cardcutter_exa_config';

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

const DEFAULT_CONFIG: ExaConfig = {
	apiKey: '',
	enabled: false
};

function getExaConfig(): ExaConfig {
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

function saveExaConfig(config: ExaConfig) {
	if (typeof window === 'undefined') return;

	// Obfuscate API key before saving
	const toSave = {
		...config,
		apiKey: config.apiKey ? obfuscate(config.apiKey) : ''
	};

	localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

class ExaConfigStore {
	config = $state<ExaConfig>(getExaConfig());

	get isConfigured(): boolean {
		return this.config.enabled && this.config.apiKey.length > 0;
	}

	updateConfig(updates: Partial<ExaConfig>) {
		this.config = { ...this.config, ...updates };
		saveExaConfig(this.config);
	}

	setApiKey(apiKey: string) {
		this.config = { ...this.config, apiKey };
		saveExaConfig(this.config);
	}

	setEnabled(enabled: boolean) {
		this.config = { ...this.config, enabled };
		saveExaConfig(this.config);
	}

	clearConfig() {
		this.config = DEFAULT_CONFIG;
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

export const exaConfig = new ExaConfigStore();
