<script lang="ts">
	interface Props {
		value: string;
		boldArray: boolean[];
		onchange?: (value: string, boldArray: boolean[]) => void;
		placeholder?: string;
	}

	let { value = $bindable(''), boldArray = $bindable([]), onchange, placeholder = '' }: Props = $props();

	let inputElement: HTMLInputElement | undefined = $state();
	let selectionStart = $state(0);
	let selectionEnd = $state(0);

	function handleSelection(e: Event) {
		const input = e.target as HTMLInputElement;
		selectionStart = input.selectionStart || 0;
		selectionEnd = input.selectionEnd || 0;
	}

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const newValue = input.value;

		// If text was added or removed, adjust the boldArray
		if (newValue.length !== value.length) {
			const diff = newValue.length - value.length;
			const cursorPos = input.selectionStart || 0;

			if (diff > 0) {
				// Characters were added - insert false values at cursor position
				const newBoldArray = [...boldArray];
				const insertPos = cursorPos - diff;
				newBoldArray.splice(insertPos, 0, ...new Array(diff).fill(false));
				boldArray = newBoldArray;
			} else {
				// Characters were removed
				const removePos = cursorPos;
				const newBoldArray = [...boldArray];
				newBoldArray.splice(removePos, Math.abs(diff));
				boldArray = newBoldArray;
			}
		}

		value = newValue;

		if (onchange) {
			onchange(value, boldArray);
		}
	}

	function toggleBold() {
		if (selectionStart === selectionEnd) return;

		const newBoldArray = [...boldArray];
		// Ensure array is long enough
		while (newBoldArray.length < value.length) {
			newBoldArray.push(false);
		}

		// Determine if we should bold or unbold based on the first selected character
		const shouldBold = !newBoldArray[selectionStart];

		for (let i = selectionStart; i < selectionEnd; i++) {
			newBoldArray[i] = shouldBold;
		}

		boldArray = newBoldArray;

		if (onchange) {
			onchange(value, boldArray);
		}
	}

	// Generate preview HTML
	let previewHtml = $derived.by(() => {
		if (!value) return '';

		let html = '';
		let currentBold = false;

		for (let i = 0; i < value.length; i++) {
			const char = value[i];
			const isBold = boldArray[i] || false;

			if (isBold !== currentBold) {
				if (currentBold) {
					html += '</strong>';
				}
				if (isBold) {
					html += '<strong>';
				}
				currentBold = isBold;
			}

			// Escape HTML characters
			const escaped = char
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');

			html += escaped;
		}

		if (currentBold) {
			html += '</strong>';
		}

		return html;
	});

	const hasSelection = $derived(selectionStart !== selectionEnd);
</script>

<div class="space-y-2">
	<div class="flex gap-2">
		<input
			bind:this={inputElement}
			type="text"
			value={value}
			oninput={handleInput}
			onmouseup={handleSelection}
			onkeyup={handleSelection}
			{placeholder}
			class="flex-1 rounded border border-gray-300 px-3 py-2"
		/>
		<button
			onclick={toggleBold}
			disabled={!hasSelection}
			class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
			type="button"
		>
			Toggle Bold
		</button>
	</div>

	{#if value}
		<div class="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
			<span class="text-gray-600">Preview: </span>
			{@html previewHtml}
		</div>
	{/if}
</div>
