// File: src/background.ts
console.log("TranslationGummy Background Script Loaded.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.action === "resetTranslationStateForTab") {
		const tabId = sender.tab?.id;
		if (tabId === undefined || tabId === null) {
			sendResponse({ success: false });
			return;
		}

		(async () => {
			try {
				const result = await chrome.storage.local.get([
					"translationToggleStateByTab",
				]);
				const currentMap: Record<string, boolean> =
					result.translationToggleStateByTab ?? {};
				const key = String(tabId);
				const nextState: Record<string, boolean> = {
					...currentMap,
					[key]: false,
				};
				await chrome.storage.local.set({
					translationToggleStateByTab: nextState,
					translationToggleState: false,
				});
				sendResponse({ success: true });
			} catch (error) {
				console.error("Error resetting tab translation state:", error);
				sendResponse({ success: false });
			}
		})();

		return true;
	}
	return undefined;
});