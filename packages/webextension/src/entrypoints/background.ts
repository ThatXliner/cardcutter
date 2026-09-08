import {
	CAPTURE_POPUP_MESSAGE,
	captureAndSave,
	type CapturePopupMessage,
	type CapturePopupResponse,
} from "~/lib/capture";

function isCapturePopupMessage(value: unknown): value is CapturePopupMessage {
	return Boolean(
		value &&
		typeof value === "object" &&
		(value as Partial<CapturePopupMessage>).type === CAPTURE_POPUP_MESSAGE,
	);
}

export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message, sender) => {
		// Only the extension's own popup may request this capture path. In
		// particular, do not accept page messages containing arbitrary HTML.
		if (
			!isCapturePopupMessage(message) ||
			sender.url !== browser.runtime.getURL("/popup.html")
		) {
			return undefined;
		}

		return (async (): Promise<CapturePopupResponse> => {
			const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
			const capture = await captureAndSave(tab || {});
			return { id: capture.id, error: capture.error };
		})();
	});
});
