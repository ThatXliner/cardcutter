export function publicationYear(date: string): string {
	return date.match(/\b(?:18|19|20|21)\d{2}\b/)?.[0] || '';
}
