/**
 * A page snapshot kept in session storage while the editor is open.
 *
 * The snapshot is deliberately made in an isolated-world executeScript call.
 * Nothing from the page is executed as extension code and no content script is
 * installed on every page.
 */
export interface Capture {
	id: string;
	url: string;
	title: string;
	html: string;
	text: string;
	selection: string;
	capturedAt: string;
	error?: string;
}

export interface PageSnapshot {
	url: string;
	title: string;
	html: string;
	text: string;
	selection: string;
	capturedAt: string;
}

export interface CaptureTab {
	id?: number;
	url?: string;
	title?: string;
}

export const MAX_HTML_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_BYTES = 1 * 1024 * 1024;
export const MAX_SELECTION_BYTES = 1 * 1024 * 1024;
export const MAX_STORED_CAPTURES = 10;
/**
 * Chrome permits roughly 10 MiB in session storage. Keep captures under 8 MiB
 * after JSON encoding, leaving headroom for extension bookkeeping and other
 * session values.
 */
export const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;
export const MAX_SESSION_STORAGE_BYTES = 8 * 1024 * 1024;
export const CAPTURE_STORAGE_PREFIX = "capture:";

/**
 * This function is serialized and run in the active tab's isolated world.
 * Keep it self-contained: executeScript cannot serialize module closures.
 */
export function capturePage(): PageSnapshot {
	const textSource =
		document.querySelector<HTMLElement>("article") ||
		document.querySelector<HTMLElement>("main") ||
		document.body;

	return {
		html: document.documentElement?.outerHTML || "",
		url: location.href,
		title: document.title,
		text: textSource?.innerText || "",
		selection: window.getSelection()?.toString() || "",
		capturedAt: new Date().toISOString(),
	};
}

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function validateString(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new Error(`Captured ${field} is not text.`);
	}
	return value;
}

/**
 * Validate the result returned by executeScript and enforce the storage
 * limits before the snapshot is persisted.
 */
export function validatePageSnapshot(value: unknown): PageSnapshot {
	if (!value || typeof value !== "object") {
		throw new Error("The active page did not return a capture.");
	}

	const snapshot = value as Record<string, unknown>;
	const html = validateString(snapshot.html, "HTML");
	const text = validateString(snapshot.text, "text");
	const url = validateString(snapshot.url, "URL");
	const title = validateString(snapshot.title, "title");
	const selection = validateString(snapshot.selection, "selection");
	const capturedAt = validateString(snapshot.capturedAt, "timestamp");

	if (byteLength(html) > MAX_HTML_BYTES) {
		throw new Error("Captured HTML exceeds the 8 MB limit.");
	}
	if (byteLength(text) > MAX_TEXT_BYTES) {
		throw new Error("Captured text exceeds the 1 MB limit.");
	}
	if (byteLength(selection) > MAX_SELECTION_BYTES) {
		throw new Error("Captured selection exceeds the 1 MB limit.");
	}
	if (
		byteLength(
			JSON.stringify({ html, text, url, title, selection, capturedAt }),
		) > MAX_CAPTURE_BYTES
	) {
		throw new Error("Captured page exceeds the 8 MB total storage limit.");
	}

	return { html, text, url, title, selection, capturedAt };
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function newCaptureId(): string {
	return crypto.randomUUID();
}

function errorCapture(tab: CaptureTab, id: string, error: unknown): Capture {
	return {
		id,
		url: tab.url || "",
		title: tab.title || "",
		html: "",
		text: "",
		selection: "",
		capturedAt: new Date().toISOString(),
		error: errorMessage(error),
	};
}

export function isSupportedUrl(url: string | undefined): boolean {
	if (!url) return false;

	try {
		const protocol = new URL(url).protocol;
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Capture one tab. Capture failures are returned as error captures so the
 * editor can explain what happened after the toolbar action completes.
 */
export async function captureTab(tab: CaptureTab): Promise<Capture> {
	const id = newCaptureId();

	if (!tab.id) {
		return errorCapture(tab, id, "No active tab is available to capture.");
	}

	if (!isSupportedUrl(tab.url)) {
		return errorCapture(
			tab,
			id,
			"Unsupported page URL. Card Cutter can capture only http(s) pages.",
		);
	}

	try {
		const [injection] = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			world: "ISOLATED",
			func: capturePage,
		});
		const snapshot = validatePageSnapshot(injection?.result);
		if (!isSupportedUrl(snapshot.url)) {
			throw new Error(
				"Unsupported page URL. Card Cutter can capture only http(s) pages.",
			);
		}

		return { id, ...snapshot };
	} catch (error) {
		return errorCapture(tab, id, error);
	}
}

function isStoredCapture(value: unknown): value is Capture {
	if (!value || typeof value !== "object") return false;
	const capture = value as Partial<Capture>;
	return (
		typeof capture.id === "string" &&
		typeof capture.url === "string" &&
		typeof capture.title === "string" &&
		typeof capture.html === "string" &&
		typeof capture.text === "string" &&
		typeof capture.selection === "string" &&
		typeof capture.capturedAt === "string" &&
		(capture.error === undefined || typeof capture.error === "string")
	);
}

function captureTimestamp(capture: Capture): number {
	const timestamp = Date.parse(capture.capturedAt);
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function captureBytes(key: string, capture: Capture): number {
	return byteLength(JSON.stringify({ [key]: capture }));
}

export function createErrorCapture(tab: CaptureTab, id: string, error: unknown): Capture {
	return errorCapture(tab, id, error);
}

/** Persist a capture and prune older captures from session storage. */
export async function saveCapture(capture: Capture): Promise<void> {
	const key = `${CAPTURE_STORAGE_PREFIX}${capture.id}`;
	const stored = await browser.storage.session.get(null);
	const captures = Object.entries(stored || {})
		.filter(([storedKey, value]) => storedKey.startsWith(CAPTURE_STORAGE_PREFIX) && isStoredCapture(value))
		.map(([storedKey, value]) => ({ key: storedKey, capture: value }));
	const existing = captures.filter(({ key: storedKey }) => storedKey !== key);
	const newCaptureBytes = captureBytes(key, capture);
	if (newCaptureBytes > MAX_SESSION_STORAGE_BYTES) {
		throw new Error("Capture exceeds the 8 MB session storage budget.");
	}

	// Keep the newest captures that fit. Pruning before set avoids exceeding
	// Chrome's session-storage quota while writing a new large page snapshot.
	existing.sort((left, right) => captureTimestamp(right.capture) - captureTimestamp(left.capture));
	const kept: typeof existing = [];
	let totalBytes = newCaptureBytes;
	for (const candidate of existing) {
		if (
			kept.length < MAX_STORED_CAPTURES - 1 &&
			totalBytes + captureBytes(candidate.key, candidate.capture) <= MAX_SESSION_STORAGE_BYTES
		) {
			kept.push(candidate);
			totalBytes += captureBytes(candidate.key, candidate.capture);
		}
	}

	const keptKeys = new Set(kept.map(({ key: storedKey }) => storedKey));
	const removeKeys = existing
		.filter(({ key: storedKey }) => !keptKeys.has(storedKey))
		.map(({ key: storedKey }) => storedKey);
	if (removeKeys.length > 0) await browser.storage.session.remove(removeKeys);
	await browser.storage.session.set({ [key]: capture });
}

export async function loadCapture(id: string): Promise<Capture | undefined> {
	if (!id) return undefined;

	const stored = await browser.storage.session.get(`${CAPTURE_STORAGE_PREFIX}${id}`);
	const capture = stored?.[`${CAPTURE_STORAGE_PREFIX}${id}`];
	return isStoredCapture(capture) ? capture : undefined;
}

export function editorUrl(id: string, error?: string): string {
	const query = new URLSearchParams({ id });
	if (error) query.set("error", error);
	return `${browser.runtime.getURL("/editor.html")}?${query}`;
}

/** Save the result of a toolbar capture before opening its editor tab. */
export async function captureAndOpenEditor(tab: CaptureTab): Promise<Capture> {
	const capture = await captureTab(tab);
	let editorCapture = capture;
	try {
		await saveCapture(capture);
	} catch (error) {
		// A quota or storage failure should still produce a small, viewable
		// error capture and open the editor for the user.
		editorCapture = createErrorCapture(
			tab,
			capture.id,
			`Could not save page capture: ${errorMessage(error)}`,
		);
		try {
			await saveCapture(editorCapture);
		} catch (fallbackError) {
			console.error("Card Cutter could not save its error capture", fallbackError);
		}
	}
	await browser.tabs.create({ url: editorUrl(editorCapture.id, editorCapture.error) });
	return editorCapture;
}
