export type CopyResult = 'rich' | 'plain' | 'failed';

export async function copyRichText(html: string): Promise<CopyResult> {
	try {
		// Create a ClipboardItem with both HTML and plain text
		const plainText = stripHtml(html);

		const type = 'text/html';
		const blob = new Blob([html], { type });
		const textBlob = new Blob([plainText], { type: 'text/plain' });

		const clipboardItem = new ClipboardItem({
			'text/html': blob,
			'text/plain': textBlob
		});

		await navigator.clipboard.write([clipboardItem]);
		return 'rich';
	} catch (error) {
		console.error('Failed to copy rich text:', error);
		// Fallback: try to copy just plain text
		try {
			const plainText = stripHtml(html);
			await navigator.clipboard.writeText(plainText);
			return 'plain';
		} catch (fallbackError) {
			console.error('Fallback copy also failed:', fallbackError);
			return 'failed';
		}
	}
}

function stripHtml(html: string): string {
	const div = document.createElement('div');
	// textContent does not represent HTML block and line boundaries. Convert
	// those boundaries before decoding the markup so the text/plain clipboard
	// flavor preserves edited evidence paragraphs.
	div.innerHTML = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p\s*>/gi, '\n\n');
	return div.textContent || '';
}
