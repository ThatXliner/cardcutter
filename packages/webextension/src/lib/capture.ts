/**
 * A page snapshot kept in IndexedDB while the editor is open.
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
 * Bound the amount of page data passed between extension contexts.
 */
export const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;
const CAPTURE_DATABASE = "cardcutter-captures";
const CAPTURE_STORE = "captures";
export const CAPTURE_POPUP_MESSAGE = "cardcutter:capture-popup";

export interface CapturePopupMessage {
	type: typeof CAPTURE_POPUP_MESSAGE;
}

export interface CapturePopupResponse {
	id: string;
	error?: string;
}

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

export function createErrorCapture(tab: CaptureTab, id: string, error: unknown): Capture {
	return errorCapture(tab, id, error);
}

function openCaptureDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(CAPTURE_DATABASE, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(CAPTURE_STORE, { keyPath: "id" });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** Persist a capture for the popup/editor handoff without session-storage quotas. */
export async function saveCapture(capture: Capture): Promise<void> {
	const database = await openCaptureDatabase();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(CAPTURE_STORE, "readwrite");
			const store = transaction.objectStore(CAPTURE_STORE);
			store.put(capture);
			const request = store.getAll();
			request.onsuccess = () => {
				const captures = (request.result as unknown[])
					.filter(isStoredCapture)
					.sort((left, right) => captureTimestamp(right) - captureTimestamp(left));
				for (const old of captures.slice(MAX_STORED_CAPTURES)) store.delete(old.id);
			};
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
}

export async function loadCapture(id: string): Promise<Capture | undefined> {
	if (!id) return undefined;
	const database = await openCaptureDatabase();
	try {
		return await new Promise<Capture | undefined>((resolve, reject) => {
			const request = database.transaction(CAPTURE_STORE, "readonly").objectStore(CAPTURE_STORE).get(id);
			request.onsuccess = () => resolve(isStoredCapture(request.result) ? request.result : undefined);
			request.onerror = () => reject(request.error);
		});
	} finally {
		database.close();
	}
}

export function editorUrl(id: string, error?: string): string {
	const query = new URLSearchParams({ id });
	if (error) query.set("error", error);
	return `${browser.runtime.getURL("/editor.html")}?${query}`;
}

/** Capture and persist a tab, retaining a small error capture when storage fails. */
export async function captureAndSave(tab: CaptureTab): Promise<Capture> {
	const capture = await captureTab(tab);
	let editorCapture = capture;
	try {
		await saveCapture(capture);
	} catch (error) {
		// A quota or storage failure should still produce a small, viewable
		// error capture for the editor.
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
	return editorCapture;
}

/** Save the result of a toolbar capture before opening its editor tab. */
export async function captureAndOpenEditor(tab: CaptureTab): Promise<Capture> {
	const editorCapture = await captureAndSave(tab);
	await browser.tabs.create({ url: editorUrl(editorCapture.id, editorCapture.error) });
	return editorCapture;
}
