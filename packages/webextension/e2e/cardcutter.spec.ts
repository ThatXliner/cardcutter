import { chromium, expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const extensionPath = join(process.cwd(), ".output", "chrome-mv3");
const bundledChrome = "/Users/me/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const chromiumPath = process.env.CHROMIUM_PATH || (existsSync(bundledChrome) ? bundledChrome : undefined);

const selectedPassage = "Selection proves that evidence must stay reliable.";
const editedPassage = `Edited: ${selectedPassage}\nA preserved line break.`;
const fullArticleText = `${selectedPassage}\n\nA second paragraph provides useful context.`;
let server: Server;
let baseUrl: string;
let requests: string[] = [];

function html(body: string, head = ""): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'">${head}</head><body>${body}</body></html>`;
}

function article(metadata: string, title = "Reliable evidence"): string {
	return html(
		`<article id="evidence"><p>${selectedPassage}</p><p>A second paragraph provides useful context.</p></article>`,
		`<title>${title}</title>${metadata}`,
	);
}

test.beforeAll(async () => {
	server = createServer((request, response) => {
		const path = new URL(request.url || "/", "http://fixture.invalid").pathname;
		requests.push(path);
		response.setHeader("content-type", "text/html; charset=utf-8");
		if (path === "/article") {
			response.end(article([
				'<meta name="citation_title" content="Reliable evidence">',
				'<meta name="citation_author" content="Doe, Jane">',
				'<meta name="citation_author" content="Smith, Sam">',
				'<meta name="citation_publication_date" content="2024-02-03">',
				'<meta name="citation_journal_title" content="Evidence Review">',
				'<meta name="citation_doi" content="10.1234/example">',
			].join("")));
			return;
		}
		if (path === "/missing") {
			response.end(article("", "Metadata omitted"));
			return;
		}
		if (path === "/malicious") {
			response.end(article(
				'<meta name="citation_title" content="&lt;img src=\'/beacon\' onerror=\'globalThis.pwned=1\'&gt;Unsafe title">' +
				'<meta name="citation_author" content="&lt;img src=\'/beacon\' onerror=\'globalThis.pwned=1\'&gt;Unsafe author">' +
				'<meta name="citation_publication_date" content="2024-02-03">' +
				'<meta name="citation_journal_title" content="Evidence Review">',
				"Unsafe source",
			));
			return;
		}
		if (path === "/paste") {
			response.end('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><div id="paste-target" contenteditable="true" aria-label="Paste target"></div>');
			return;
		}
		response.statusCode = 404;
		response.end("Not found");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("The article fixture did not start.");
	baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function openExtension(): Promise<{ context: BrowserContext; profile: string; extensionId: string }> {
	if (!existsSync(extensionPath)) {
		throw new Error(`Missing built extension at ${extensionPath}. Run pnpm build before pnpm test:e2e.`);
	}
	const profile = await mkdtemp(join(tmpdir(), "cardcutter-e2e-"));
	const context = await chromium.launchPersistentContext(profile, {
		headless: true,
		...(chromiumPath ? { executablePath: chromiumPath } : { channel: "chromium" }),
		args: [
			`--disable-extensions-except=${extensionPath}`,
			`--load-extension=${extensionPath}`,
			"--enable-unsafe-extension-debugging",
			"--headless=new",
		],
	});
	const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
	return { context, profile, extensionId: new URL(worker.url()).host };
}

async function closeExtension(context: BrowserContext, profile: string): Promise<void> {
	await context.close();
	await rm(profile, { recursive: true, force: true });
}

async function selectPassage(page: Page): Promise<void> {
	await page.evaluate((passage) => {
		const text = document.querySelector("#evidence p")?.firstChild;
		if (!text) throw new Error("Fixture passage was not found.");
		const range = document.createRange();
		range.setStart(text, 0);
		range.setEnd(text, passage.length);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}, selectedPassage);
}

async function waitForActionListener(context: BrowserContext, extensionId: string): Promise<void> {
	const worker = context.serviceWorkers().find(candidate => new URL(candidate.url()).host === extensionId);
	if (!worker) throw new Error(`The ${extensionId} service worker is unavailable.`);
	const hasListener = () => worker.evaluate(() => (globalThis as unknown as {
		chrome: { runtime: { onMessage: { hasListeners(): boolean } } };
	}).chrome.runtime.onMessage.hasListeners());
	if (!await hasListener()) {
		await expect.poll(hasListener, { timeout: 10_000 }).toBe(true);
	}
}

type PopupCommand = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
type Popup = {
	evaluate: <T = unknown>(expression: string) => Promise<T>;
	command: PopupCommand;
};
type BeforeExpand = (popup: Popup) => Promise<void>;
type BrowserSession = Awaited<ReturnType<Browser["newBrowserCDPSession"]>>;
type TargetInfo = {
	targetId: string;
	type: string;
	url: string;
	attached: boolean;
	browserContextId?: string;
};

const popupCommandTimeout = 20_000;

function createPopupProtocol(browserSession: BrowserSession, sessionId: string): Popup & { cleanup: () => void } {
	type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; method: string };
	const pending = new Map<number, Pending>();
	let nextId = 0;

	const onMessage = (event: { sessionId: string; message: string }) => {
		if (event.sessionId !== sessionId) return;
		let response: { id?: unknown; result?: unknown; error?: { message?: string } };
		try {
			response = JSON.parse(event.message) as typeof response;
		} catch {
			return;
		}
		if (typeof response.id !== "number") return;
		const request = pending.get(response.id);
		if (!request) return;
		pending.delete(response.id);
		clearTimeout(request.timer);
		if (response.error) {
			request.reject(new Error(response.error.message || `Popup CDP command failed: ${request.method}`));
		} else {
			request.resolve(response.result);
		}
	};

	browserSession.on("Target.receivedMessageFromTarget", onMessage);

	const command: PopupCommand = <T = unknown>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolve, reject) => {
		const id = ++nextId;
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(new Error(`Timed out waiting ${popupCommandTimeout}ms for popup CDP command ${method}.`));
		}, popupCommandTimeout);
		pending.set(id, { resolve: (value) => resolve(value as T), reject, timer, method });
		void browserSession.send("Target.sendMessageToTarget", {
			sessionId,
			message: JSON.stringify({ id, method, params }),
		}).catch((error: unknown) => {
			const request = pending.get(id);
			if (!request) return;
			pending.delete(id);
			clearTimeout(request.timer);
			request.reject(error instanceof Error ? error : new Error(String(error)));
		});
	});

	const evaluate = async <T,>(expression: string): Promise<T> => {
		const response = await command<{ result?: { value?: unknown }; exceptionDetails?: { text?: string; exception?: { description?: string } } }>("Runtime.evaluate", {
			expression,
			returnByValue: true,
			awaitPromise: true,
		});
		if (response.exceptionDetails) {
			throw new Error(response.exceptionDetails.text || response.exceptionDetails.exception?.description || "Popup evaluation failed.");
		}
		return response.result?.value as T;
	};

	const cleanup = () => {
		browserSession.off("Target.receivedMessageFromTarget", onMessage);
		for (const request of pending.values()) {
			clearTimeout(request.timer);
			request.reject(new Error("Popup CDP session closed."));
		}
		pending.clear();
	};

	return { command, evaluate, cleanup };
}

function isPopupEditorUrl(urlValue: string, extensionId: string): boolean {
	try {
		const url = new URL(urlValue);
		return url.protocol === "chrome-extension:" &&
			url.host === extensionId &&
			url.pathname === "/editor.html" &&
			url.searchParams.get("popup") === "1" &&
			Boolean(url.searchParams.get("id"));
	} catch {
		return false;
	}
}

function isPopupEditorTarget(target: TargetInfo, extensionId: string, browserContextId?: string): boolean {
	return target.type === "page" &&
		isPopupEditorUrl(target.url, extensionId) &&
		(browserContextId === undefined || target.browserContextId === browserContextId);
}

async function triggerAction(page: Page, extensionId: string, beforeExpand?: BeforeExpand): Promise<Page> {
	const context = page.context();
	await page.bringToFront();
	await waitForActionListener(context, extensionId);
	const pageSession = await context.newCDPSession(page);
	const { targetInfo } = await pageSession.send("Target.getTargetInfo");
	const browser = context.browser();
	if (!browser) throw new Error("The persistent Chromium browser is unavailable.");
	const browserSession = await browser.newBrowserCDPSession();
	const getTabTargets = async () => (await browserSession.send("Target.getTargets", {
		filter: [{ type: "tab", exclude: false }, { exclude: true }],
	})).targetInfos;
	const getTargets = async () => (await browserSession.send("Target.getTargets")).targetInfos as TargetInfo[];
	const tabTargetsBeforeAction = await getTabTargets();
	const targetsBeforeAction = await getTargets();
	const targetIdsBeforeAction = new Set(targetsBeforeAction.map(target => target.targetId));
	const tabTarget = tabTargetsBeforeAction.find(target => target.url === targetInfo.url && target.browserContextId === targetInfo.browserContextId);
	if (!tabTarget) throw new Error(`Could not find the tab target for ${targetInfo.url}.`);
	const getNormalTabTargets = async () => (await getTabTargets()).filter(target => !isPopupEditorUrl(target.url, extensionId));
	const normalTabTargetsBeforeAction = await getNormalTabTargets();
	await browserSession.send("Target.activateTarget", { targetId: tabTarget.targetId });
	try {
		await browserSession.send("Extensions.triggerAction", { id: extensionId, targetId: tabTarget.targetId });
	} catch (error) {
		throw new Error(`Extensions.triggerAction failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	let popupTarget: TargetInfo | undefined;
	await expect.poll(async () => {
		popupTarget = (await getTargets()).find(target => !targetIdsBeforeAction.has(target.targetId) && isPopupEditorTarget(target, extensionId, tabTarget.browserContextId));
		return Boolean(popupTarget);
	}, { timeout: popupCommandTimeout, intervals: [100, 250, 500] }).toBe(true);
	if (!popupTarget) {
		throw new Error(`The toolbar action did not expose an extension editor popup target. CDP targets: ${JSON.stringify(await getTargets())}`);
	}

	const { sessionId } = await browserSession.send("Target.attachToTarget", { targetId: popupTarget.targetId, flatten: false });
	const popup = createPopupProtocol(browserSession, sessionId);
	try {
		const popupUrl = new URL(popupTarget.url);
		const captureId = popupUrl.searchParams.get("id");
		if (!captureId) throw new Error(`The popup editor did not include a capture id: ${popupTarget.url}`);
		await expect.poll(() => popup.evaluate<{ ready: boolean; tagEnabled: boolean }>(`(() => ({ ready: Boolean(document.querySelector('[data-intro="evidence-text"]')), tagEnabled: (() => { const element = document.querySelector('#card-tag'); return element instanceof HTMLInputElement && !element.disabled; })() }))()`), { timeout: popupCommandTimeout, intervals: [100, 250, 500] }).toEqual({ ready: true, tagEnabled: true });
		if (beforeExpand) await beforeExpand(popup);
		const normalTabTargetsBeforeExpansion = await getNormalTabTargets();
		expect(normalTabTargetsBeforeExpansion).toHaveLength(normalTabTargetsBeforeAction.length);

		const pagesBeforeExpansion = new Set(context.pages());
		await popup.evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === 'Open in new tab'); if (!(button instanceof HTMLButtonElement)) throw new Error('Open in new tab button was not found.'); if (button.disabled) throw new Error('Open in new tab button is disabled.'); button.click(); })()`);
		let editor: Page | undefined;
		for (let attempt = 0; attempt < 100; attempt += 1) {
			editor = context.pages().find(candidate => {
				if (pagesBeforeExpansion.has(candidate)) return false;
				try {
					const url = new URL(candidate.url());
					return url.protocol === "chrome-extension:" && url.host === extensionId && url.pathname === "/editor.html" && url.searchParams.get("id") === captureId && !url.searchParams.has("popup");
				} catch {
					return false;
				}
			});
			if (editor) break;
			await page.waitForTimeout(100);
		}
		if (!editor) throw new Error(`The popup editor did not open a full editor tab for capture ${captureId}. Pages: ${JSON.stringify(context.pages().map(candidate => candidate.url()))}`);
		await editor.waitForURL((url) => {
			const parsed = new URL(url);
			return parsed.protocol === "chrome-extension:" && parsed.host === extensionId && parsed.pathname === "/editor.html" && parsed.searchParams.get("id") === captureId && !parsed.searchParams.has("popup");
		});
		await editor.waitForLoadState("domcontentloaded");
		return editor;
	} finally {
		popup.cleanup();
		try {
			await browserSession.send("Target.detachFromTarget", { sessionId });
		} catch {
			// The popup may already have closed itself after opening the full tab.
		}
		await browserSession.detach().catch(() => undefined);
	}
}

function recordPageErrors(context: BrowserContext): () => string[] {
	const errors: string[] = [];
	const listen = (page: Page) => page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
	for (const page of context.pages()) listen(page);
	context.on("page", listen);
	return () => errors;
}

async function attachCaptureDiagnostics(testInfo: TestInfo, editor: Page, pageErrors: () => string[]): Promise<string> {
	const storage = await editor.evaluate(async () => {
		const browserChrome = (globalThis as unknown as {
			chrome: { storage: { session: { get(keys: null): Promise<Record<string, unknown>> }; local: { get(keys: null): Promise<Record<string, unknown>> } } };
		}).chrome;
		const read = (area: { get(keys: null): Promise<Record<string, unknown>> }) => area.get(null);
		return {
			session: await read(browserChrome.storage.session),
			local: await read(browserChrome.storage.local),
		};
	});
	const diagnostic = {
			url: editor.url(),
			bodyText: await editor.locator("body").innerText(),
			alertText: await editor.getByRole("alert").allTextContents(),
			pageErrors: pageErrors(),
			storage,
	};
	const body = JSON.stringify(diagnostic, null, 2);
	await testInfo.attach("capture-diagnostics.json", {
		body,
		contentType: "application/json",
	});
	return body;
}

test("captures a selected article, extracts local metadata, formats and persists a rich-text card", async () => {
	const { context, profile, extensionId } = await openExtension();
	try {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		const articlePage = await context.newPage();
		const pageErrors: Error[] = [];
		requests = [];
		await articlePage.goto(`${baseUrl}/article`);
		await selectPassage(articlePage);
		const requestCountBeforeCapture = requests.length;
		const popupTag = "Popup edit survives expansion.";
		const editor = await triggerAction(articlePage, extensionId, async (popup) => {
			const state = () => popup.evaluate<{ evidence: string; author: string; title: string; publisher: string }>(`(() => ({
				evidence: document.querySelector('[data-intro="evidence-text"]')?.value || '',
				author: document.querySelector('#author-first-0')?.value || '',
				title: document.querySelector('#article-title')?.value || '',
				publisher: document.querySelector('#source-publisher')?.value || '',
			}))()`);
			await expect.poll(state, { timeout: popupCommandTimeout, intervals: [100, 250, 500] }).toEqual({
				evidence: selectedPassage,
				author: "Jane",
				title: "Reliable evidence",
				publisher: "Evidence Review",
			});
			await popup.evaluate(`(() => {
				const input = document.querySelector('#card-tag');
				if (!(input instanceof HTMLInputElement)) throw new Error('Card tag input was not found.');
				const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
				if (!setter) throw new Error('Card tag value setter was not found.');
				setter.call(input, ${JSON.stringify(popupTag)});
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
			})()`);
			await expect.poll(() => popup.evaluate<string>(`document.querySelector('[role="status"]')?.textContent || ''`), { timeout: popupCommandTimeout, intervals: [100, 250, 500] }).toContain("Saved on this device");
			const screenshot = await popup.command<{ data: string }>("Page.captureScreenshot", { format: "png" });
			if (typeof screenshot.data !== "string") throw new Error("Popup screenshot response did not contain image data.");
			await mkdir(join(process.cwd(), "test-results"), { recursive: true });
			await writeFile(join(process.cwd(), "test-results", "popup.png"), Buffer.from(screenshot.data, "base64"));
		});
		editor.on("pageerror", error => pageErrors.push(error));

		await expect(editor.locator("[data-intro=evidence-text]")).toHaveValue(selectedPassage);
		await expect(editor.locator("#card-tag")).toHaveValue(popupTag);
		await expect(editor.locator("#author-first-1")).toBeVisible();
		await expect(editor.locator("#author-first-0")).toHaveValue("Jane");
		await expect(editor.locator("#author-last-0")).toHaveValue("Doe");
		await expect(editor.locator("#author-first-1")).toHaveValue("Sam");
		await expect(editor.locator("#author-last-1")).toHaveValue("Smith");
		await expect(editor.locator("#date")).toHaveValue(/2024/);
		await expect(editor.locator("#article-title")).toHaveValue("Reliable evidence");
		await expect(editor.locator("#source-publisher")).toHaveValue("Evidence Review");
		await expect(requests).toHaveLength(requestCountBeforeCapture);

		const evidence = editor.locator("[data-intro=evidence-text]");
		await evidence.evaluate((element, length) => {
			const textarea = element as HTMLTextAreaElement;
			textarea.setSelectionRange(0, length);
			textarea.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
		}, selectedPassage.length);
		const highlight = editor.getByRole("button", { name: "Level 1 (Highest)" });
		await expect(highlight).toBeEnabled();
		await highlight.click();
		const markedPreview = editor.locator("[data-intro=preview] span");
		await expect(markedPreview).toHaveText(selectedPassage);
		await expect(markedPreview).toHaveAttribute("style", /font-weight:\s*bold;.*text-decoration:\s*underline/);

		await evidence.evaluate((element) => {
			const textarea = element as HTMLTextAreaElement;
			textarea.setSelectionRange(0, 0);
		});
		await evidence.pressSequentially("Edited: ");
		await evidence.evaluate((element) => {
			const textarea = element as HTMLTextAreaElement;
			textarea.setSelectionRange(textarea.value.length, textarea.value.length);
		});
		await evidence.pressSequentially("\nA preserved line break.");
		await expect(evidence).toHaveValue(editedPassage);
		await expect(markedPreview).toHaveText(selectedPassage);
		await expect(markedPreview).toHaveAttribute("style", /font-weight:\s*bold;.*text-decoration:\s*underline/);
		expect(await editor.locator("[data-intro=preview]").innerHTML()).toContain("<br>");
		await editor.locator("#card-tag").fill("Reliable sourcing protects arguments.");
		await expect(editor.getByRole("status").first()).toHaveText("Saved on this device");
		await editor.screenshot({ path: "test-results/editor.png", fullPage: true });

		await editor.getByRole("button", { name: "Copy to Clipboard" }).click();
		await expect(editor.getByRole("button", { name: "Copied!" })).toBeVisible();
		const clipboard = await editor.evaluate(async () => {
			const items = await navigator.clipboard.read();
			const rich = items.find(item => item.types.includes("text/html"));
			return {
				plain: await navigator.clipboard.readText(),
				html: rich ? await (await rich.getType("text/html")).text() : "",
			};
		});
		expect(clipboard.plain).toContain("Reliable sourcing protects arguments.");
		expect(clipboard.plain).toContain(editedPassage);
		expect(clipboard.html).toMatch(/font-weight:\s*bold/);
		expect(clipboard.html).toMatch(/text-decoration:\s*underline/);
		expect(clipboard.html).toContain(selectedPassage);

		await articlePage.goto(`${baseUrl}/paste`);
		const pasteTarget = articlePage.getByLabel("Paste target");
		await pasteTarget.focus();
		await articlePage.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
		await expect(pasteTarget).toContainText("Reliable sourcing protects arguments.");
		const pasted = await pasteTarget.evaluate(element => element.innerHTML);
		expect(pasted).toContain("font-weight");
		expect(pasted).toContain("text-decoration");
		expect(pasted).toContain("<br>");
		expect(await pasteTarget.locator("span").evaluateAll((spans) => spans
		.filter((span) => /font-weight:\s*bold/.test(span.getAttribute("style") || "") && /text-decoration:\s*underline/.test(span.getAttribute("style") || ""))
		.map((span) => span.textContent))).toEqual([selectedPassage]);

		await editor.reload();
		await expect(editor.locator("#card-tag")).toHaveValue("Reliable sourcing protects arguments.");
		await expect(editor.locator("[data-intro=evidence-text]")).toHaveValue(editedPassage);
		await expect(editor.locator("[data-intro=preview] span")).toHaveText(selectedPassage);
		await expect(editor.locator("[data-intro=preview] span")).toHaveAttribute("style", /font-weight:\s*bold;.*text-decoration:\s*underline/);
		const savedCards = editor.locator("details").filter({ hasText: "Saved cards" });
		await savedCards.locator("summary").click();
		await expect(savedCards).toContainText("Reliable evidence");
		expect(pageErrors).toEqual([]);
	} finally {
		await closeExtension(context, profile);
	}
});

test("keeps missing metadata blank and captures the whole article when no passage is selected", async () => {
	const { context, profile, extensionId } = await openExtension();
	try {
		const articlePage = await context.newPage();
		await articlePage.goto(`${baseUrl}/missing`);
		const editor = await triggerAction(articlePage, extensionId);
		await expect(editor.locator("[data-intro=evidence-text]")).toHaveValue(fullArticleText);
		await expect(editor.locator("#author-first-0")).toHaveValue("");
		await expect(editor.locator("#author-last-0")).toHaveValue("");
		await expect(editor.locator("#date")).toHaveValue("");
		await expect(editor.locator("[data-intro=preview]")).toContainText("Missing author, date");
	} finally {
		await closeExtension(context, profile);
	}
});

test("uses embedded metadata from an offline ScienceDirect snapshot without supplementary requests", async () => {
	const { context, profile, extensionId } = await openExtension();
	const scienceDirectUrl = "https://www.sciencedirect.com/science/article/pii/S0000000000000000";
	try {
		const httpRequests: string[] = [];
		context.on("request", request => {
			if (/^https?:/.test(request.url())) httpRequests.push(request.url());
		});
		await context.route(/^https?:\/\//, async route => {
			if (route.request().url() !== scienceDirectUrl) {
				await route.abort();
				return;
			}
			await route.fulfill({
				contentType: "text/html; charset=utf-8",
				body: article([
					'<meta name="citation_title" content="Reliable evidence">',
					'<meta name="citation_author" content="Doe, Jane">',
					'<meta name="citation_author" content="Smith, Sam">',
					'<meta name="citation_publication_date" content="2024-02-03">',
					'<meta name="citation_journal_title" content="Evidence Review">',
				].join("")),
			});
		});
		const articlePage = await context.newPage();
		await articlePage.goto(scienceDirectUrl);
		await selectPassage(articlePage);
		const editor = await triggerAction(articlePage, extensionId);

		await expect(editor.locator("#author-first-1")).toBeVisible();
		await expect(editor.locator("#author-first-0")).toHaveValue("Jane");
		await expect(editor.locator("#author-last-1")).toHaveValue("Smith");
		await expect(editor.locator("#date")).toHaveValue(/2024/);
		await expect(editor.locator("#article-title")).toHaveValue("Reliable evidence");
		await expect(editor.locator("#source-publisher")).toHaveValue("Evidence Review");
		expect(httpRequests).toEqual([scienceDirectUrl]);
	} finally {
		await closeExtension(context, profile);
	}
});

test("persists a configured highlight level after the editor reloads", async () => {
	const { context, profile, extensionId } = await openExtension();
	try {
		const articlePage = await context.newPage();
		await articlePage.goto(`${baseUrl}/article`);
		const editor = await triggerAction(articlePage, extensionId);
		await expect(editor.locator("[data-intro=evidence-text]")).toBeVisible();
		await editor.getByRole("button", { name: "Configure Highlight Levels" }).click();
		const fontSizes = editor.getByLabel("Font Size (%)");
		await expect(fontSizes.first()).toHaveValue("100");
		await fontSizes.first().fill("105");
		await editor.getByRole("button", { name: "×" }).click();
		await editor.waitForTimeout(200);
		await editor.reload();
		await expect(editor.locator("[data-intro=evidence-text]")).toBeVisible();
		await editor.getByRole("button", { name: "Configure Highlight Levels" }).click();
		await expect(editor.getByLabel("Font Size (%)").first()).toHaveValue("105");
	} finally {
		await closeExtension(context, profile);
	}
});

test("escapes hostile extracted metadata and shows a useful restricted-page error", async ({}, testInfo) => {
	const { context, profile, extensionId } = await openExtension();
	try {
		const pageErrors = recordPageErrors(context);
		const articlePage = await context.newPage();
		requests = [];
		await articlePage.goto(`${baseUrl}/malicious`);
		const editor = await triggerAction(articlePage, extensionId);
		try {
			await expect(editor.locator("[data-intro=preview]")).toContainText("Unsafe title");
		} catch (error) {
			console.error(`Hostile-capture diagnostics:\n${await attachCaptureDiagnostics(testInfo, editor, pageErrors)}`);
			throw error;
		}
		expect(await editor.locator("[data-intro=preview] img, [data-intro=preview] script").count()).toBe(0);
		expect(await editor.evaluate(() => (globalThis as { pwned?: unknown }).pwned)).toBeUndefined();
		expect(requests).not.toContain("/beacon");

		const restricted = await context.newPage();
		await restricted.goto("chrome://version/");
		const errorEditor = await triggerAction(restricted, extensionId);
		await expect(errorEditor.getByRole("alert")).toContainText("Unsupported page URL. Card Cutter can capture only http(s) pages.");
	} finally {
		await closeExtension(context, profile);
	}
});
