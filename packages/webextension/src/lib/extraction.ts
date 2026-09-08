import { browser } from "wxt/browser";
import type { Capture } from "./capture";
import type { ExtractMetadataResult } from "ztractor";

export type { ExtractMetadataResult } from "ztractor";

export const EXTRACTION_TIMEOUT_MS = 20_000;

const REQUEST_TYPE = "cardcutter:extract";
const RESPONSE_TYPE = "cardcutter:extract-result";

interface SandboxResultMessage {
	type: typeof RESPONSE_TYPE;
	token: string;
	result: ExtractMetadataResult;
}

function isResult(value: unknown): value is ExtractMetadataResult {
	return Boolean(
		value &&
		typeof value === "object" &&
		typeof (value as { success?: unknown }).success === "boolean",
	);
}

/**
 * Run ztractor in the extension's manifest sandbox. The sandbox has an
 * opaque origin, so the target origin for postMessage must be "*"; the
 * response is accepted only when its source is this exact iframe and its
 * token matches this request.
 */
export function extractCapture(capture: Capture): Promise<ExtractMetadataResult> {
	return new Promise((resolve, reject) => {
		const iframe = document.createElement("iframe");
		const token = crypto.randomUUID();
		let settled = false;
		let requestSent = false;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const cleanup = () => {
			window.removeEventListener("message", onMessage);
			iframe.removeEventListener("load", onLoad);
			iframe.removeEventListener("error", onError);
			if (timeoutId !== undefined) clearTimeout(timeoutId);
			iframe.remove();
		};

		const finish = (callback: () => void) => {
			if (settled) return;
			settled = true;
			cleanup();
			callback();
		};

		const onMessage = (event: MessageEvent<unknown>) => {
			if (event.source !== iframe.contentWindow) return;

			const message = event.data as Partial<SandboxResultMessage> | null;
			if (
				!message ||
				message.type !== RESPONSE_TYPE ||
				message.token !== token ||
				!isResult(message.result)
			) {
				return;
			}

			finish(() => resolve(message.result!));
		};

		const onLoad = () => {
			if (settled || requestSent) return;
			requestSent = true;

			const target = iframe.contentWindow;
			if (!target) {
				finish(() => reject(new Error("The extraction sandbox did not initialize.")));
				return;
			}

			target.postMessage(
			{
				type: REQUEST_TYPE,
				token,
				capture: { url: capture.url, html: capture.html },
			},
				"*",
			);
		};

		const onError = () => {
			finish(() => reject(new Error("The extraction sandbox failed to load.")));
		};

		window.addEventListener("message", onMessage);
		iframe.addEventListener("load", onLoad, { once: true });
		iframe.addEventListener("error", onError, { once: true });
		iframe.hidden = true;
		iframe.setAttribute("aria-hidden", "true");
		iframe.src = browser.runtime.getURL("/sandbox.html");

		timeoutId = setTimeout(() => {
			finish(() => reject(new Error("Metadata extraction timed out after 20 seconds.")));
		}, EXTRACTION_TIMEOUT_MS);

		const parent = document.body || document.documentElement;
		if (!parent) {
			finish(() => reject(new Error("The editor document is not ready for metadata extraction.")));
			return;
		}
		parent.appendChild(iframe);
	});
}
