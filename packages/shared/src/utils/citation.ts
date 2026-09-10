import type { CitationData, HighlightLevel, TextSegment } from '../types';

/** Escape all source-derived text before it reaches an HTML preview or clipboard. */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function escapedLines(text: string): string {
	return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

function qualificationsHtml(value: string, bold: boolean[]): string {
	let html = '';
	let currentBold = false;
	for (let index = 0; index < value.length; index += 1) {
		const isBold = bold[index] || false;
		if (isBold !== currentBold) {
			html += isBold ? '<strong>' : '</strong>';
			currentBold = isBold;
		}
		html += escapedLines(value[index]);
	}
	return currentBold ? `${html}</strong>` : html;
}


export function publicationYear(date: string): string {
	return date.match(/\b(?:18|19|20|21)\d{2}\b/)?.[0] || '';
}

function personHtml(firstName: string, lastName: string, year: string): string {
	const name = lastName || firstName;
	if (!name) return `<strong>[Author not found]${year ? ` ${escapeHtml(year)}` : ''}</strong>`;
	const boldName = year ? `${escapedLines(name)} ${escapeHtml(year)}` : escapedLines(name);
	if (lastName && firstName) return `<strong>${boldName}</strong>, ${escapedLines(firstName)}`;
	return `<strong>${boldName}</strong>`;
}

/** Generate citation HTML in the existing NSDA card layout. */
export function generateCitationHtml(citation: CitationData): string {
	const year = publicationYear(citation.date) || '[Year not found]';
	let html = '<p style="margin: 0; font-family: Calibri, sans-serif; font-size: 13pt;">';

	if (citation.authorType === 'organization') {
		html += `<strong>${escapedLines(citation.organizationName || '[Author not found]')} ${escapeHtml(year)}</strong>`;
		if (citation.organizationQualifications) {
			html += ` (${qualificationsHtml(citation.organizationQualifications, citation.organizationQualificationsBold)})`;
		}
	} else if (citation.authorType === 'etal') {
		const author = citation.authors[0] || { firstName: '', lastName: '', qualifications: '', qualificationsBold: [] };
		html += personHtml(author.firstName, author.lastName, year);
		if (author.qualifications) html += ` <span style="font-size: 8pt;">(${qualificationsHtml(author.qualifications, author.qualificationsBold)})</span>`;
		html += ' <em>et al.</em>';
	} else {
		const authors = citation.authors.length ? citation.authors : [{ firstName: '', lastName: '', qualifications: '', qualificationsBold: [] }];
		authors.forEach((author, index) => {
			if (index) html += '; ';
			html += personHtml(author.firstName, author.lastName, index === 0 ? year : '');
			if (author.qualifications) {
				const small = authors.length > 2;
				html += small ? ' <span style="font-size: 8pt;">(' : ' (';
				html += qualificationsHtml(author.qualifications, author.qualificationsBold);
				html += small ? ')</span>' : ')';
			}
		});
	}

	html += ' [';
	html += `<em>${escapedLines(citation.articleTitle || '[Title not found]')}</em>`;
	if (citation.source) html += `; ${escapedLines(citation.source)}`;
	if (citation.url) html += `; ${escapedLines(citation.url)}`;
	if (citation.dateOfAccess) html += `; DOA ${escapedLines(citation.dateOfAccess)}`;
	if (citation.code) html += ` //${escapedLines(citation.code)}`;
	html += ']</p>';
	return html;
}

/** Generate the citation, optional tag, and highlighted evidence for a card. */
export function generateCardHtml(
	citation: CitationData,
	sourceText: string,
	textSegments: TextSegment[],
	highlightLevels: HighlightLevel[],
	tag = ''
): string {
	let html = tag.trim()
		? `<p style="margin: 0 0 8px; font-family: Calibri, sans-serif; font-size: 13pt; font-weight: bold;">${escapedLines(tag)}</p>`
		: '';
	html += generateCitationHtml(citation);
	html += '<p style="margin-top: 8px; font-family: Calibri, sans-serif; font-size: 8pt;">';

	const segments = textSegments.length ? textSegments : [{ text: sourceText, highlightLevel: null }];
	for (const segment of segments) {
		const level = highlightLevels.find((item) => item.id === segment.highlightLevel);
		if (!level) {
			html += escapedLines(segment.text);
			continue;
		}
		let style = 'font-family: Calibri, sans-serif; font-size: 8pt;';
		if (level.bold) style += ' font-weight: bold;';
		if (level.underline) style += ' text-decoration: underline;';
		if (level.fontSize !== 100) style += ` font-size: ${(8 * level.fontSize) / 100}pt;`;
		if (level.color && level.color !== '#000000') style += ` color: ${escapeHtml(level.color)};`;
		if (level.backgroundColor && level.backgroundColor !== '#ffffff') style += ` background-color: ${escapeHtml(level.backgroundColor)};`;
		html += `<span style="${style}">${escapedLines(segment.text)}</span>`;
	}

	return `${html}</p>`;
}
