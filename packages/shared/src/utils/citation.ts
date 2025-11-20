import type { CitationData, HighlightLevel, TextSegment } from '../types';

/**
 * Escape HTML characters for safe rendering
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Generate qualifications HTML with selective bolding
 */
function generateQualificationsHtml(qualifications: string, qualificationsBold: boolean[], fontSize?: string): string {
	let html = '';
	let currentBold = false;

	for (let j = 0; j < qualifications.length; j++) {
		const char = qualifications[j];
		const isBold = qualificationsBold[j] || false;

		if (isBold !== currentBold) {
			if (currentBold) {
				html += '</strong>';
			}
			if (isBold) {
				html += '<strong>';
			}
			currentBold = isBold;
		}

		html += escapeHtml(char);
	}

	if (currentBold) {
		html += '</strong>';
	}

	return html;
}

/**
 * Generate citation HTML in NSDA format
 */
export function generateCitationHtml(citation: CitationData): string {
	const {
		authorType,
		organizationName,
		organizationQualifications,
		organizationQualificationsBold,
		authors,
		date,
		articleTitle,
		source,
		url,
		dateOfAccess,
		code,
		pageNumber
	} = citation;

	let html = '<p style="margin: 0; font-family: Calibri, sans-serif; font-size: 13pt;">';

	// Handle organization mode
	if (authorType === 'organization') {
		if (pageNumber) {
			html += `<strong>${organizationName} ${pageNumber}</strong>`;
		} else {
			html += `<strong>${organizationName}</strong>`;
		}

		if (organizationQualifications) {
			html += ' (';
			html += generateQualificationsHtml(organizationQualifications, organizationQualificationsBold);
			html += ')';
		}
	} else if (authorType === 'etal') {
		// Handle "et al." mode - only show first author + et al.
		const author = authors[0];
		const { firstName, lastName, qualifications, qualificationsBold } = author;

		// Name formatting for first author
		if (lastName && pageNumber) {
			html += `<strong>${lastName} ${pageNumber}</strong>`;
			if (firstName) {
				html += ` ${firstName}`;
			}
		} else if (lastName && firstName) {
			html += `<strong>${lastName}</strong>, ${firstName}`;
		} else if (firstName) {
			const firstNameParts = firstName.trim().split(' ');
			const onlyFirstName = firstNameParts[0];
			const restOfFirstName = firstNameParts.slice(1).join(' ');

			html += `<strong>${onlyFirstName}</strong>`;
			if (restOfFirstName) {
				html += ` ${restOfFirstName}`;
			}
			if (lastName) {
				html += ` ${lastName}`;
			}
		}

		// Qualifications with selective bolding (8pt font)
		if (qualifications) {
			html += ' <span style="font-size: 8pt;">(';
			html += generateQualificationsHtml(qualifications, qualificationsBold);
			html += ')</span>';
		}

		html += ' <em>et al.</em>';
	} else {
		// Handle individual authors
		for (let i = 0; i < authors.length; i++) {
			const author = authors[i];
			const { firstName, lastName, qualifications, qualificationsBold } = author;

			if (i > 0) {
				html += '; ';
			}

			// Name formatting
			if (lastName && pageNumber && i === 0) {
				html += `<strong>${lastName} ${pageNumber}</strong>`;
				if (firstName) {
					html += ` ${firstName}`;
				}
			} else if (lastName && firstName) {
				html += `<strong>${lastName}</strong>, ${firstName}`;
			} else if (firstName) {
				const firstNameParts = firstName.trim().split(' ');
				const onlyFirstName = firstNameParts[0];
				const restOfFirstName = firstNameParts.slice(1).join(' ');

				html += `<strong>${onlyFirstName}</strong>`;
				if (restOfFirstName) {
					html += ` ${restOfFirstName}`;
				}
				if (lastName) {
					html += ` ${lastName}`;
				}
			}

			// Qualifications with selective bolding
			if (qualifications) {
				if (authors.length > 2) {
					html += ' <span style="font-size: 8pt;">(';
				} else {
					html += ' (';
				}

				html += generateQualificationsHtml(qualifications, qualificationsBold);

				if (authors.length > 2) {
					html += ')</span>';
				} else {
					html += ')';
				}
			}
		}
	}

	// Date (only year is bold)
	if (date) {
		const yearMatch = date.match(/\b(\d{4})\b/);
		if (yearMatch) {
			const year = yearMatch[1];
			const dateWithBoldYear = date.replace(year, `<strong>${year}</strong>`);
			html += ` ${dateWithBoldYear}`;
		} else {
			html += ` ${date}`;
		}
	}

	// Start bracket
	html += ' [';

	// Article title in italics
	if (articleTitle) {
		html += `<em>${articleTitle}</em>`;
	}

	// Source/Publisher (skip if it looks like a URL)
	const sourceIsUrl =
		source && (source.includes('://') || source.startsWith('www.') || source.includes('.'));
	if (source && !sourceIsUrl) {
		html += `; ${source}`;
	}

	// URL
	if (url) {
		html += `; ${url}`;
	}

	// Date of access
	if (dateOfAccess) {
		html += `; DOA ${dateOfAccess}`;
	}

	// Code
	if (code) {
		html += ` //${code}`;
	}

	html += ']</p>';

	return html;
}

/**
 * Generate complete card HTML with citation and highlighted evidence
 */
export function generateCardHtml(
	citation: CitationData,
	sourceText: string,
	textSegments: TextSegment[],
	highlightLevels: HighlightLevel[]
): string {
	let html = generateCitationHtml(citation);
	html += '<p style="margin-top: 8px; font-family: Calibri, sans-serif; font-size: 8pt;">';

	if (textSegments.length > 0) {
		for (const segment of textSegments) {
			const level = highlightLevels.find((l) => l.id === segment.highlightLevel);

			if (level) {
				let style = 'font-family: Calibri, sans-serif; font-size: 8pt;';
				if (level.bold) style += ' font-weight: bold;';
				if (level.underline) style += ' text-decoration: underline;';
				if (level.fontSize !== 100) style += ` font-size: ${(8 * level.fontSize) / 100}pt;`;
				if (level.color && level.color !== '#000000') style += ` color: ${level.color};`;
				if (level.backgroundColor && level.backgroundColor !== '#ffffff')
					style += ` background-color: ${level.backgroundColor};`;

				html += `<span style="${style}">${escapeHtml(segment.text)}</span>`;
			} else {
				html += escapeHtml(segment.text);
			}
		}
	} else {
		html += escapeHtml(sourceText);
	}

	html += '</p>';
	return html;
}
