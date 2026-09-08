import { extractMetadata, type ExtractMetadataResult } from "ztractor";

const MAX_HTML_BYTES = 8 * 1024 * 1024;
const REQUEST_TYPE = "cardcutter:extract";
const RESPONSE_TYPE = "cardcutter:extract-result";

interface SandboxRequest {
	type: typeof REQUEST_TYPE;
	token: string;
	capture: {
		url: string;
		html: string;
	};
}

function isRequest(value: unknown): value is SandboxRequest {
	if (!value || typeof value !== "object") return false;
	const request = value as Partial<SandboxRequest>;
	return Boolean(
		request.type === REQUEST_TYPE &&
		typeof request.token === "string" &&
		request.token.length > 0 &&
		request.token.length <= 128 &&
		request.capture &&
		typeof request.capture.url === "string" &&
		typeof request.capture.html === "string",
	);
}

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function postResult(token: string, result: ExtractMetadataResult): void {
	window.parent.postMessage(
		{
			type: RESPONSE_TYPE,
			token,
			result,
		},
		"*",
	);
}

let handled = false;

window.addEventListener("message", (event: MessageEvent<unknown>) => {
	if (handled || event.source !== window.parent || !isRequest(event.data)) return;
	handled = true;

	const request = event.data;
	if (byteLength(request.capture.html) > MAX_HTML_BYTES) {
		postResult(request.token, {
			success: false,
			error: "Captured HTML exceeds the 8 MB limit.",
		});
		return;
	}

	void (async () => {
		try {
			const result = await extractMetadata({
				url: request.capture.url,
				html: request.capture.html,
				network: "deny",
				timeout: 12_000,
			});
			postResult(request.token, result);
		} catch (error) {
			postResult(request.token, {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	})();
});
