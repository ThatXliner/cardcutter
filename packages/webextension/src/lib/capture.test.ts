import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
	MAX_HTML_BYTES,
	MAX_CAPTURE_BYTES,
	MAX_SELECTION_BYTES,
	MAX_STORED_CAPTURES,
	MAX_TEXT_BYTES,
	capturePage,
	captureAndOpenEditor,
	captureAndSave,
	captureTab,
	editorUrl,
	loadCapture,
	saveCapture,
	validatePageSnapshot,
	type Capture,
} from "./capture";

function makeCapture(id: string, capturedAt: string): Capture {
	return {
		id,
		url: `https://example.test/${id}`,
		title: id,
		html: "<html></html>",
		text: id,
		selection: "",
		capturedAt,
	};
}

describe("capture host", () => {
	let executeScript: ReturnType<typeof vi.fn>;
	let tabsCreate: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase("cardcutter-captures");
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
		executeScript = vi.fn();
		tabsCreate = vi.fn();

		vi.stubGlobal("crypto", { randomUUID: () => "new-capture" });
		vi.stubGlobal("browser", {
			scripting: { executeScript },
			storage: { session: { set: vi.fn(() => { throw new Error("QuotaExceededError: session storage is full"); }) } },
			tabs: { create: tabsCreate },
			runtime: { getURL: vi.fn((path: string) => `chrome-extension://id${path}`) },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("captures a supported tab in the isolated world", async () => {
		executeScript.mockResolvedValueOnce([
			{
				result: {
					url: "https://example.test/article",
					title: "Example",
					html: "<html><body>Article</body></html>",
					text: "Article",
					selection: "Article",
					capturedAt: "2026-01-01T00:00:00.000Z",
				},
			},
		]);

		const capture = await captureTab({ id: 7, url: "https://example.test/article", title: "Example" });

		expect(capture).toMatchObject({
			id: "new-capture",
			url: "https://example.test/article",
			title: "Example",
			text: "Article",
		});
		expect(capture.error).toBeUndefined();
		expect(executeScript).toHaveBeenCalledWith({
			target: { tabId: 7 },
			world: "ISOLATED",
			func: capturePage,
		});
	});

	it("saves a capture without opening a tab", async () => {
		executeScript.mockResolvedValueOnce([
			{
				result: {
					url: "https://example.test/article",
					title: "Example",
					html: "<html></html>",
					text: "Article",
					selection: "",
					capturedAt: "2026-01-01T00:00:00.000Z",
				},
			},
		]);

		const capture = await captureAndSave({ id: 7, url: "https://example.test/article", title: "Example" });

		expect(capture.id).toBe("new-capture");
		expect(await loadCapture(capture.id)).toEqual(capture);
		expect(browser.storage.session.set).not.toHaveBeenCalled();
		expect(tabsCreate).not.toHaveBeenCalled();
	});

	it("retains the wrapper that opens the saved capture in a new tab", async () => {
		executeScript.mockResolvedValueOnce([
			{
				result: {
					url: "https://example.test/article",
					title: "Example",
					html: "<html></html>",
					text: "Article",
					selection: "",
					capturedAt: "2026-01-01T00:00:00.000Z",
				},
			},
		]);

		const capture = await captureAndOpenEditor({ id: 7, url: "https://example.test/article", title: "Example" });

		expect(tabsCreate).toHaveBeenCalledWith({ url: editorUrl(capture.id) });
	});

	it("records an explicit error for unsupported pages without executing page code", async () => {
		const capture = await captureTab({ id: 7, url: "chrome://settings", title: "Settings" });

		expect(capture.error).toContain("Unsupported page URL");
		expect(executeScript).not.toHaveBeenCalled();
	});

	it("turns oversized snapshots into explicit error captures", async () => {
		executeScript.mockResolvedValueOnce([
			{
				result: {
					url: "https://example.test/article",
					title: "Example",
					html: "x".repeat(MAX_HTML_BYTES + 1),
					text: "Article",
					selection: "",
					capturedAt: "2026-01-01T00:00:00.000Z",
				},
			},
		]);

		const capture = await captureTab({ id: 7, url: "https://example.test/article", title: "Example" });
		expect(capture.error).toBe("Captured HTML exceeds the 8 MB limit.");
	});

	it("rejects a page that navigated to an unsupported URL during capture", async () => {
		executeScript.mockResolvedValueOnce([
			{
				result: {
					url: "chrome://settings",
					title: "Settings",
					html: "<html></html>",
					text: "Settings",
					selection: "",
					capturedAt: "2026-01-01T00:00:00.000Z",
				},
			},
		]);

		const capture = await captureTab({ id: 7, url: "https://example.test/article" });
		expect(capture.error).toContain("Unsupported page URL");
	});

	it("enforces the text limit before persistence", () => {
		expect(() =>
			validatePageSnapshot({
				url: "https://example.test/article",
				title: "Example",
				html: "<html></html>",
				text: "x".repeat(MAX_TEXT_BYTES + 1),
				selection: "",
				capturedAt: "2026-01-01T00:00:00.000Z",
			}),
		).toThrow("Captured text exceeds the 1 MB limit.");
	});

	it("rejects snapshots whose encoded fields exceed the total storage budget", () => {
		expect(() =>
			validatePageSnapshot({
				url: "https://example.test/article",
				title: "Example",
				html: "x".repeat(MAX_CAPTURE_BYTES - 100),
				text: "x".repeat(200),
				selection: "",
				capturedAt: "2026-01-01T00:00:00.000Z",
			}),
		).toThrow("Captured page exceeds the 8 MB total storage limit.");
	});

	it("enforces the separate 1 MB selection limit", () => {
		expect(() =>
			validatePageSnapshot({
				url: "https://example.test/article",
				title: "Example",
				html: "<html></html>",
				text: "Article",
				selection: "x".repeat(MAX_SELECTION_BYTES + 1),
				capturedAt: "2026-01-01T00:00:00.000Z",
			}),
		).toThrow("Captured selection exceeds the 1 MB limit.");
	});

	it("keeps only the ten newest captures", async () => {
		for (let index = 0; index < MAX_STORED_CAPTURES; index += 1) {
			await saveCapture(makeCapture(
				`old-${index}`,
				`2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
			));
		}

		await saveCapture(makeCapture("new", "2026-02-01T00:00:00.000Z"));

		expect(await loadCapture("old-0")).toBeUndefined();
		expect(await loadCapture("old-1")).toBeDefined();
		expect(await loadCapture("new")).toBeDefined();
	});

	it("hands a large page to the editor even when session storage is full", async () => {
		const capture = makeCapture("large", "2026-02-01T00:00:00.000Z");
		capture.html = "x".repeat(7 * 1024 * 1024);
		await saveCapture(capture);
		expect(await loadCapture(capture.id)).toEqual(capture);
		expect(browser.storage.session.set).not.toHaveBeenCalled();
	});

	it("loads a capture by its id", async () => {
		const capture = makeCapture("saved", "2026-01-01T00:00:00.000Z");
		await saveCapture(capture);

		expect(await loadCapture("saved")).toEqual(capture);
		expect(await loadCapture("missing")).toBeUndefined();
	});
});
