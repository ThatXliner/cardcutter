import type { HighlightLevel } from '../types';
import { getStorageAdapter } from '../utils/storage';

const DEFAULT_HIGHLIGHT_LEVELS: HighlightLevel[] = [
	{
		id: 1,
		name: 'Level 1 (Highest)',
		bold: true,
		underline: true,
		fontSize: 100,
		backgroundColor: '',
		color: ''
	},
	{
		id: 2,
		name: 'Level 2',
		bold: true,
		underline: false,
		fontSize: 100,
		backgroundColor: '',
		color: ''
	},
	{
		id: 3,
		name: 'Level 3',
		bold: false,
		underline: true,
		fontSize: 100,
		backgroundColor: '',
		color: ''
	}
];

const STORAGE_KEY = 'cardcutter_highlight_levels';

async function getHighlightLevels(): Promise<HighlightLevel[]> {
	try {
		const adapter = getStorageAdapter();
		const stored = await adapter.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (error) {
		console.error('Failed to load highlight levels:', error);
	}
	return DEFAULT_HIGHLIGHT_LEVELS;
}

async function saveHighlightLevels(levels: HighlightLevel[]) {
	try {
		const adapter = getStorageAdapter();
		await adapter.setItem(STORAGE_KEY, JSON.stringify(levels));
	} catch (error) {
		console.error('Failed to save highlight levels:', error);
	}
}

class HighlightConfigStore {
	levels = $state<HighlightLevel[]>(DEFAULT_HIGHLIGHT_LEVELS);
	private initialized = false;

	async init() {
		if (this.initialized) return;
		this.levels = await getHighlightLevels();
		this.initialized = true;
	}

	updateLevel(id: number, updates: Partial<HighlightLevel>) {
		this.levels = this.levels.map((level) =>
			level.id === id ? { ...level, ...updates } : level
		);
		saveHighlightLevels(this.levels);
	}

	addLevel() {
		const maxId = Math.max(...this.levels.map((l) => l.id), 0);
		const newLevel: HighlightLevel = {
			id: maxId + 1,
			name: `Level ${maxId + 1}`,
			bold: false,
			underline: false,
			fontSize: 100,
			backgroundColor: '',
			color: ''
		};
		this.levels = [...this.levels, newLevel];
		saveHighlightLevels(this.levels);
	}

	removeLevel(id: number) {
		this.levels = this.levels.filter((level) => level.id !== id);
		saveHighlightLevels(this.levels);
	}

	resetToDefaults() {
		this.levels = DEFAULT_HIGHLIGHT_LEVELS;
		saveHighlightLevels(this.levels);
	}
}

export const highlightConfig = new HighlightConfigStore();
