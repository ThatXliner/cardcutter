import { captureAndOpenEditor } from "~/lib/capture";

export default defineBackground(() => {
	browser.action.onClicked.addListener((tab) => {
		void captureAndOpenEditor(tab).catch((error) => {
			// A storage or tab-opening failure is outside the page-capture path.
			// Keep the service worker alive long enough to report it without
			// turning a toolbar click into an unhandled rejection.
			console.error("Card Cutter could not open the editor", error);
		});
	});
});
