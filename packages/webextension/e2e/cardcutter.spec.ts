import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
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

async function triggerAction(page: Page, extensionId: string): Promise<Page> {
	const context = page.context();
	const existingPages = new Set(context.pages());
	await page.bringToFront();
	const pageSession = await context.newCDPSession(page);
	const { targetInfo } = await pageSession.send("Target.getTargetInfo");
	const browser = context.browser();
	if (!browser) throw new Error("The persistent Chromium browser is unavailable.");
	const browserSession = await browser.newBrowserCDPSession();
	const { targetInfos } = await browserSession.send("Target.getTargets", {
		filter: [{ type: "tab", exclude: false }, { exclude: true }],
	});
	const tabTarget = targetInfos.find(target => target.url === targetInfo.url && target.browserContextId === targetInfo.browserContextId);
	if (!tabTarget) throw new Error(`Could not find the tab target for ${targetInfo.url}.`);
	await browserSession.send("Target.activateTarget", { targetId: tabTarget.targetId });
	try {
		await browserSession.send("Extensions.triggerAction", { id: extensionId, targetId: tabTarget.targetId });
	} catch (error) {
		throw new Error(`Extensions.triggerAction failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	let editor: Page | undefined;
	for (let attempt = 0; attempt < 100; attempt += 1) {
		editor = context.pages().find(candidate => !existingPages.has(candidate) && candidate.url().startsWith(`chrome-extension://${extensionId}/editor.html`));
		if (editor) break;
		await page.waitForTimeout(100);
	}
	if (!editor) throw new Error("The toolbar action did not open an editor tab.");
	await editor.waitForURL(`chrome-extension://${extensionId}/editor.html?*`);
	await editor.waitForLoadState("domcontentloaded");
	return editor;
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
		const editor = await triggerAction(articlePage, extensionId);
		editor.on("pageerror", error => pageErrors.push(error));

		await expect(editor.locator("[data-intro=evidence-text]")).toHaveValue(selectedPassage);
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

test("escapes hostile extracted metadata and shows a useful restricted-page error", async () => {
	const { context, profile, extensionId } = await openExtension();
	try {
		const articlePage = await context.newPage();
		requests = [];
		await articlePage.goto(`${baseUrl}/malicious`);
		const editor = await triggerAction(articlePage, extensionId);
		await expect(editor.locator("[data-intro=preview]")).toContainText("Unsafe title");
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
