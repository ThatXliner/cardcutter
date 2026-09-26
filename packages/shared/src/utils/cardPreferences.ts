const CODE_KEY = 'cardcutter_user_code';
const TAG_KEY = 'cardcutter_user_tag';
const COLLAPSE_NEWLINES_KEY = 'cardcutter_collapse_newlines';

export function loadCardPreferences() {
	if (typeof localStorage === 'undefined') return { code: '', tag: '', collapseNewlines: false };
	return {
		code: localStorage.getItem(CODE_KEY) || '',
		tag: localStorage.getItem(TAG_KEY) || '',
		collapseNewlines: localStorage.getItem(COLLAPSE_NEWLINES_KEY) === 'true'
	};
}

export function saveCodePreference(code: string): void {
	localStorage.setItem(CODE_KEY, code);
}

export function saveTagPreference(tag: string): void {
	localStorage.setItem(TAG_KEY, tag);
}

export function saveCollapseNewlinesPreference(enabled: boolean): void {
	localStorage.setItem(COLLAPSE_NEWLINES_KEY, String(enabled));
}
