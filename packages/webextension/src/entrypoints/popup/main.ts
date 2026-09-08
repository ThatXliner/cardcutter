import { browser } from "wxt/browser";
import {
	CAPTURE_POPUP_MESSAGE,
	editorUrl,
	type CapturePopupResponse,
} from "../../lib/capture";
import "./style.css";

const app = document.getElementById("app");

function render(message: string, error = false): void {
	if (!app) return;
	app.replaceChildren();
	const heading = document.createElement("h1");
	heading.textContent = "Card Cutter";
	const detail = document.createElement("p");
	detail.textContent = message;
	if (error) detail.setAttribute("role", "alert");
	app.append(heading, detail);
}

function isCaptureResponse(value: unknown): value is CapturePopupResponse {
	return Boolean(
		value &&
		typeof value === "object" &&
		typeof (value as Partial<CapturePopupResponse>).id === "string" &&
		((value as Partial<CapturePopupResponse>).error === undefined ||
			typeof (value as Partial<CapturePopupResponse>).error === "string"),
	);
}

async function openEditor(): Promise<void> {
	render("Capturing the active page…");
	try {
		const response: unknown = await browser.runtime.sendMessage({
			type: CAPTURE_POPUP_MESSAGE,
		});
		if (!isCaptureResponse(response)) {
			throw new Error("The capture service returned an invalid response.");
		}

		const target = new URL(editorUrl(response.id, response.error));
		target.searchParams.set("popup", "1");
		location.replace(target.toString());
	} catch (error) {
		render(
			`Could not capture the active page: ${error instanceof Error ? error.message : String(error)}`,
			true,
		);
	}
}

void openEditor();
