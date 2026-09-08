import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CAPTURE_STORAGE_PREFIX,
	MAX_HTML_BYTES,
	MAX_CAPTURE_BYTES,
	MAX_SELECTION_BYTES,
	MAX_SESSION_STORAGE_BYTES,
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
	let state: Record<string, unknown>;
	let executeScript: ReturnType<typeof vi.fn>;
	let remove: ReturnType<typeof vi.fn>;
	let set: ReturnType<typeof vi.fn>;
	let tabsCreate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		state = {};
		executeScript = vi.fn();
		set = vi.fn(async (values: Record<string, unknown>) => Object.assign(state, values));
		remove = vi.fn(async (keys: string[]) => {
			for (const key of keys) delete state[key];
		});
		tabsCreate = vi.fn();

		vi.stubGlobal("crypto", { randomUUID: () => "new-capture" });
		vi.stubGlobal("browser", {
			scripting: { executeScript },
			storage: {
				session: {
				set,
					get: vi.fn(async (key: string | null) => {
						if (key === null) return { ...state };
						return { [key]: state[key] };
					}),
					remove,
				},
			},
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
		expect(state[`${CAPTURE_STORAGE_PREFIX}new-capture`]).toEqual(capture);
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

	it("keeps only the ten newest session captures", async () => {
		for (let index = 0; index < MAX_STORED_CAPTURES; index += 1) {
			state[`${CAPTURE_STORAGE_PREFIX}old-${index}`] = makeCapture(
				`old-${index}`,
				`2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
			);
		}

		await saveCapture(makeCapture("new", "2026-02-01T00:00:00.000Z"));

		expect(Object.keys(state).filter((key) => key.startsWith(CAPTURE_STORAGE_PREFIX))).toHaveLength(MAX_STORED_CAPTURES);
		expect(state[`${CAPTURE_STORAGE_PREFIX}old-0`]).toBeUndefined();
		expect(state[`${CAPTURE_STORAGE_PREFIX}new`]).toBeDefined();
		expect(remove).toHaveBeenCalledWith([`${CAPTURE_STORAGE_PREFIX}old-0`]);
	});

	it("removes oversized older captures before writing the new capture", async () => {
		for (let index = 0; index < 3; index += 1) {
			const capture = makeCapture(`large-${index}`, `2026-01-0${index + 1}T00:00:00.000Z`);
			capture.html = "x".repeat(3 * 1024 * 1024);
			state[`${CAPTURE_STORAGE_PREFIX}${capture.id}`] = capture;
		}
		const next = makeCapture("large-new", "2026-02-01T00:00:00.000Z");
		next.html = "x".repeat(3 * 1024 * 1024);

		await saveCapture(next);

		expect(Object.keys(state).filter((key) => key.startsWith(CAPTURE_STORAGE_PREFIX))).toHaveLength(2);
		expect(remove).toHaveBeenCalledBefore(set);
		expect(MAX_SESSION_STORAGE_BYTES).toBe(8 * 1024 * 1024);
	});

	it("loads a capture by its session storage id", async () => {
		const capture = makeCapture("saved", "2026-01-01T00:00:00.000Z");
		state[`${CAPTURE_STORAGE_PREFIX}saved`] = capture;

		expect(await loadCapture("saved")).toEqual(capture);
		expect(await loadCapture("missing")).toBeUndefined();
	});
});
