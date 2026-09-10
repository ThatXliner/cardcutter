import { describe, expect, it } from 'vitest';
import type { CitationData } from '@acme/shared/types';
import { generateCardHtml, generateCitationHtml } from '@acme/shared/utils/citation';

function citation(overrides: Partial<CitationData> = {}): CitationData {
	return {
		authorType: 'individual',
		organizationName: '',
		organizationQualifications: '',
		organizationQualificationsBold: [],
		authors: [{ firstName: 'Ada', lastName: 'Lovelace', qualifications: 'Lead <Researcher>', qualificationsBold: [true] }],
		date: 'November 9, 2022',
		articleTitle: 'Evidence <matters>',
		source: 'RAND Corporation',
		url: 'https://example.test/?q=<unsafe>',
		dateOfAccess: '11/9/22',
		code: 'CL',
		...overrides
	};
}

describe('citation HTML', () => {
	it('escapes every dynamic citation field while preserving publisher names and line breaks', () => {
		const html = generateCardHtml(citation({ source: 'news.example.com\nPublisher <unsafe>' }), 'Line one\nLine <two>', [], [], 'Tag <unsafe>');
		expect(html).not.toContain('<unsafe>');
		expect(html).toContain('news.example.com<br>Publisher &lt;unsafe&gt;');
		expect(html).toContain('Line one<br>Line &lt;two&gt;');
		expect(html).toContain('Tag &lt;unsafe&gt;');
	});

	it('uses only the publication year beside the first author and keeps additional authors', () => {
		const html = generateCitationHtml(citation({
			authors: [
				{ firstName: 'Ada', lastName: 'Lovelace', qualifications: '', qualificationsBold: [] },
				{ firstName: '', lastName: 'Research Collective', qualifications: '', qualificationsBold: [] }
			]
		}));
		expect(html).toContain('<strong>Lovelace 2022</strong>, Ada');
		expect(html).toContain('<strong>Research Collective</strong>');
		expect(html).not.toContain('November 9');
		expect(html).not.toContain('p. 5');
	});

	it('ignores the page number kept by older saved citations', () => {
		const legacyCitation = { ...citation(), pageNumber: '5' };
		const html = generateCitationHtml(legacyCitation);
		expect(html).not.toContain('p. 5');
	});

	it('puts the year beside organization, et al., and single-name authors', () => {
		expect(generateCitationHtml(citation({
			authorType: 'organization',
			organizationName: 'Research Collective'
		}))).toContain('<strong>Research Collective 2022</strong>');
		expect(generateCitationHtml(citation({
			authorType: 'etal',
			authors: [{ firstName: '', lastName: 'Lovelace', qualifications: '', qualificationsBold: [] }]
		}))).toContain('<strong>Lovelace 2022</strong> <em>et al.</em>');
		expect(generateCitationHtml(citation({
			authors: [{ firstName: 'Ada', lastName: '', qualifications: '', qualificationsBold: [] }]
		}))).toContain('<strong>Ada 2022</strong>');
	});

	it('retains selective qualification bolding and explicit missing placeholders', () => {
		const html = generateCitationHtml(citation({
			authors: [{ firstName: '', lastName: '', qualifications: '', qualificationsBold: [] }],
			date: '',
			articleTitle: ''
		}));
		expect(html).toContain('[Author not found]');
		expect(html).toContain('[Year not found]');
		expect(html).toContain('[Title not found]');
		expect(generateCitationHtml(citation())).toContain('(<strong>L</strong>ead &lt;Researcher&gt;)');
	});
});
