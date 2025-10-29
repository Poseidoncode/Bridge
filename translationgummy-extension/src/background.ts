// File: src/background.ts
console.log("Translationbridge Background Script Loaded.");

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
	} else if (message?.action === "getTabTranslationState") {
		const tabId = sender.tab?.id;
		if (tabId === undefined || tabId === null) {
			sendResponse({ success: false, enabled: false });
			return false;
		}

		(async () => {
			try {
				const result = await chrome.storage.local.get([
					"translationToggleStateByTab",
				]);
				const currentMap: Record<string, boolean> =
					result.translationToggleStateByTab ?? {};
				const enabled = Boolean(currentMap[String(tabId)]);
				sendResponse({ success: true, enabled });
			} catch (error) {
				console.error("Error reading tab translation state:", error);
				sendResponse({ success: false, enabled: false });
			}
		})();

		return true;
	}
	return undefined;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
	if (changeInfo.status !== "complete") {
		return;
	}
	try {
		const result = await chrome.storage.local.get(["translationToggleStateByTab"]);
		const map: Record<string, boolean> = result.translationToggleStateByTab ?? {};
		if (!map[String(tabId)]) {
			return;
		}
		await chrome.tabs.sendMessage(tabId, { action: "translatePage" });
	} catch (error) {
		console.error("Error triggering translation on tab update:", error);
	}
});