export async function copyRichText(html: string): Promise<boolean> {
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
		return true;
	} catch (error) {
		console.error('Failed to copy rich text:', error);
		// Fallback: try to copy just plain text
		try {
			const plainText = stripHtml(html);
			await navigator.clipboard.writeText(plainText);
			return true;
		} catch (fallbackError) {
			console.error('Fallback copy also failed:', fallbackError);
			return false;
		}
	}
}

function stripHtml(html: string): string {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.textContent || div.innerText || '';
}
