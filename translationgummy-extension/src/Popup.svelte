<script lang="ts">
  import { onMount } from "svelte";

  // Using Svelte 5 Runes
  let targetWriteLang = $state("en");
  let targetReadLang = $state("zh-Hant");
  let currentPageTranslated = $state(false);
  let userIntendedState = $state(false);

  // Debug: Track state changes
  $effect(() => {
    console.log(
      `State changed - currentPageTranslated: ${currentPageTranslated}, userIntendedState: ${userIntendedState}`
    );
  });

  // Storage listener for page navigation detection
  let storageListener: ((changes: any, namespace: string) => void) | null =
    null;
  let currentTabId: number | null = null;
  let tabToggleState: Record<string, boolean> = {};

  // On component mount, load settings from chrome.storage
  onMount(() => {
    const initializeSettings = async () => {
      console.log("Popup mounted, loading settings...");

      // Get current tab info to detect tab changes
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      currentTabId = tabs[0]?.id ?? null;
      console.log("Current tab ID:", currentTabId);

      const syncResult = await chrome.storage.sync.get([
        "targetWriteLang",
        "targetReadLang",
      ]);
      console.log("Sync storage result:", syncResult);
      targetWriteLang = syncResult.targetWriteLang ?? "en";
      targetReadLang = syncResult.targetReadLang ?? "zh-Hant";

      const localResult = await chrome.storage.local.get([
        "translationToggleStateByTab",
      ]);
      console.log("Local storage result:", localResult);

      tabToggleState = localResult.translationToggleStateByTab ?? {};
      const savedToggleState = getTabToggleState(currentTabId);
      userIntendedState = savedToggleState;
      currentPageTranslated = savedToggleState;

      if (currentTabId !== null && !(String(currentTabId) in tabToggleState)) {
        await setTabToggleState(currentTabId, false);
        console.log("Initialized toggle state for new tab:", currentTabId);
      } else {
        console.log("Loaded toggle state from storage:", savedToggleState);
      }

      // Check current page translation status
      console.log("Checking current page status...");
      await checkCurrentPageStatus();

      // Listen for storage changes to detect page navigation
      storageListener = (changes: any, namespace: string) => {
        if (namespace === "local" && changes.translationToggleStateByTab) {
          const updatedMap = changes.translationToggleStateByTab.newValue ?? {};
          tabToggleState = updatedMap;
          if (currentTabId !== null) {
            const newState = getTabToggleState(currentTabId);
            console.log(
              "Storage changed - translationToggleStateByTab for current tab:",
              newState
            );
            if (!newState && (currentPageTranslated || userIntendedState)) {
              console.log(
                "Page navigation detected - resetting translation states"
              );
            }
            currentPageTranslated = newState;
            userIntendedState = newState;
          } else {
            console.log(
              "Storage changed - translationToggleStateByTab updated without active tab"
            );
          }
        }
      };

      chrome.storage.onChanged.addListener(storageListener);
    };

    initializeSettings();

    return () => {
      if (storageListener) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  });

  function getTabToggleState(tabId: number | null): boolean {
    if (tabId === null) {
      return false;
    }
    const value = tabToggleState[String(tabId)];
    return typeof value === "boolean" ? value : false;
  }

  async function setTabToggleState(tabId: number | null, value: boolean) {
    if (tabId === null) {
      return;
    }
    const key = String(tabId);
    const nextState: Record<string, boolean> = {
      ...tabToggleState,
      [key]: value,
    };
    tabToggleState = nextState;
    await chrome.storage.local.set({
      translationToggleStateByTab: nextState,
      translationToggleState: value,
    });
  }

  // Handle translate button click
  async function handleTranslate() {
    console.log(
      "Translate button clicked, sending message to content script..."
    );
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0] && tabs[0].id) {
        console.log(`Sending translatePage message to tab ${tabs[0].id}`);
        await chrome.tabs.sendMessage(tabs[0].id, { action: "translatePage" });
        console.log("translatePage message sent successfully");
        setTimeout(() => {
          console.log("Checking status after translation...");
          checkCurrentPageStatus();
        }, 500);
      } else {
        console.error("No active tab found");
      }
    } catch (error) {
      console.error("Error sending translate message:", error);
    }
  }

  // Handle revert button click
  async function handleRevert() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await chrome.tabs.sendMessage(tabs[0].id, { action: "revertPage" });
      setTimeout(() => checkCurrentPageStatus(), 500);
    }
  }

  // Handle toggle change
  async function handleToggleChange() {
    const checkbox = document.getElementById(
      "translation-toggle"
    ) as HTMLInputElement;
    const newState = checkbox.checked;

    console.log("Toggle change event fired");
    console.log("Checkbox checked state:", newState);
    console.log("Previous intended state:", userIntendedState);

    // Update user's intended state immediately
    userIntendedState = newState;

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTabId = tabs[0]?.id ?? null;
      if (activeTabId !== null) {
        currentTabId = activeTabId;
        if (newState) {
          // If turning on, translate the page
          console.log("User wants to turn translation ON");
          await chrome.tabs.sendMessage(activeTabId, {
            action: "translatePage",
          });
        } else {
          // If turning off, revert the page
          console.log("User wants to turn translation OFF");
          await chrome.tabs.sendMessage(activeTabId, { action: "revertPage" });
        }

        // Update UI to match user's intention immediately
        currentPageTranslated = newState;
        console.log("Updated UI to match user intention:", newState);

        // Don't automatically check status to avoid overriding user intention
        console.log("Translation request sent, UI state preserved");
      } else {
        console.error("No active tab found");
      }

      await setTabToggleState(activeTabId, newState);
    } catch (error) {
      console.error("Error in toggle change:", error);
      // Revert to actual state on error
      await checkCurrentPageStatus();
    }
  }

  // Handle language selector change
  async function handleLanguageChange() {
    // Only perform translation if the toggle is ON
    console.log(
      `currentPageTranslated: ${currentPageTranslated}, userIntendedState: ${userIntendedState}`
    );
    // Save the new language settings
    if (currentPageTranslated && userIntendedState) {
      console.log(
        "Language changed while translation is ON, updating translations..."
      );
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tabs[0] && tabs[0].id) {
          // Send message to content script to update existing translations
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateExistingTranslations",
          });
        }
      } catch (error) {
        console.error(
          "Error updating translations after language change:",
          error
        );
      }
    } else {
      console.log(
        "Language changed while translation is OFF, no action needed"
      );
    }
  }

  // Check current page translation status (only for sync, don't override user intention)
  async function checkCurrentPageStatus() {
    try {
      console.log("Getting current tab...");
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      console.log("Current tabs:", tabs);
      currentTabId = tabs[0]?.id ?? null;

      if (tabs[0] && tabs[0].id) {
        console.log(`Sending getPageTranslationStatus to tab ${tabs[0].id}`);
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: "getPageTranslationStatus",
        });
        console.log("Received response:", response);

        if (response) {
          // Only update if user hasn't explicitly set a state yet
          if (!userIntendedState) {
            currentPageTranslated = response.isTranslated;
            userIntendedState = response.isTranslated;
            await setTabToggleState(currentTabId, response.isTranslated);
            console.log(
              "Updated state from page status (no user intention):",
              response.isTranslated
            );
          } else {
            console.log(
              "Keeping user intended state:",
              userIntendedState,
              "Page status:",
              response.isTranslated
            );
          }
        } else {
          console.log("No response received from content script");
        }
      } else {
        console.error("No active tab found");
      }
    } catch (error) {
      console.error("Error checking page status:", error);
      // Keep current state on error
    }
  }

  $effect(() => {
    chrome.storage.sync.set({ targetWriteLang, targetReadLang });
  });
</script>

<main>
  <div class="rain-container">
    <div class="raindrop" style="--i: 0; --color: #4285F4; --delay: 0s;"></div>
    <div
      class="raindrop"
      style="--i: 1; --color: #DB4437; --delay: 0.5s;"
    ></div>
    <div class="raindrop" style="--i: 2; --color: #F4B400; --delay: 1s;"></div>
    <div
      class="raindrop"
      style="--i: 3; --color: #0F9D58; --delay: 1.5s;"
    ></div>
    <div class="raindrop" style="--i: 4; --color: #4285F4; --delay: 2s;"></div>
    <div
      class="raindrop"
      style="--i: 5; --color: #DB4437; --delay: 2.5s;"
    ></div>
    <div class="raindrop" style="--i: 6; --color: #F4B400; --delay: 3s;"></div>
    <div
      class="raindrop"
      style="--i: 7; --color: #0F9D58; --delay: 3.5s;"
    ></div>
    <div class="raindrop" style="--i: 8; --color: #4285F4; --delay: 4s;"></div>
    <div
      class="raindrop"
      style="--i: 9; --color: #DB4437; --delay: 4.5s;"
    ></div>
  </div>
  <div class="glow-effect"></div>

  <div class="header">
    <div class="logo-container">
      <div class="logo-glow"></div>
      <h1>
        <span class="logo-text">Bridge</span>
      </h1>
      <div class="subtitle">AI Translation Engine</div>
    </div>
  </div>

  <div class="feature-card">
    <div class="card-header">
      <div class="icon-wrapper">
        <span class="icon">🌐</span>
      </div>
      <div class="card-title">
        <label for="translation-toggle">Real-time Translation</label>
        <small>One-click webpage translation to your native language</small>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          id="translation-toggle"
          bind:checked={currentPageTranslated}
          onchange={handleToggleChange}
        />
        <span class="slider"></span>
      </label>
    </div>

    <div class="language-selector">
      <div class="selector-label">
        <span class="label-icon">📖</span>
        <span>Reading Language</span>
      </div>
      <select
        id="read-lang"
        bind:value={targetReadLang}
        onchange={handleLanguageChange}
        class="modern-select"
      >
        <option value="en">🇬🇧 English</option>
        <option value="zh-Hant">🇹🇼 繁體中文</option>
        <option value="zh-CN">🇨🇳 简体中文</option>
        <option value="ja">🇯🇵 日本語</option>
        <option value="ko">🇰🇷 한국어</option>
        <option value="fr">🇫🇷 Français</option>
        <option value="de">🇩🇪 Deutsch</option>
        <option value="es">🇪🇸 Español</option>
        <option value="it">🇮🇹 Italiano</option>
        <option value="pt">🇵🇹 Português</option>
        <option value="ru">🇷🇺 Русский</option>
        <option value="ar">🇸🇦 العربية</option>
        <option value="hi">🇮🇳 हिन्दी</option>
        <option value="th">🇹🇭 ไทย</option>
        <option value="vi">🇻🇳 Tiếng Việt</option>
        <option value="id">🇮🇩 Bahasa Indonesia</option>
        <option value="ms">🇲🇾 Bahasa Melayu</option>
      </select>
    </div>
  </div>

  <div class="feature-card">
    <div class="card-header">
      <div class="icon-wrapper">
        <span class="icon">✍️</span>
      </div>
      <div class="card-title">
        <label for="write-lang">Smart Input</label>
        <small>Automatically translate your input text to target language</small
        >
      </div>
    </div>

    <div class="language-selector">
      <div class="selector-label">
        <span class="label-icon">🎯</span>
        <span>Output Language</span>
      </div>
      <select
        id="write-lang"
        bind:value={targetWriteLang}
        onchange={handleLanguageChange}
        class="modern-select"
      >
        <option value="en">🇬🇧 English</option>
        <option value="zh-Hant">🇹🇼 繁體中文</option>
        <option value="zh-CN">🇨🇳 简体中文</option>
        <option value="ja">🇯🇵 日本語</option>
        <option value="ko">🇰🇷 한국어</option>
        <option value="fr">🇫🇷 Français</option>
        <option value="de">🇩🇪 Deutsch</option>
        <option value="es">🇪🇸 Español</option>
        <option value="it">🇮🇹 Italiano</option>
        <option value="pt">🇵🇹 Português</option>
        <option value="ru">🇷🇺 Русский</option>
        <option value="ar">🇸🇦 العربية</option>
        <option value="hi">🇮🇳 हिन्दी</option>
        <option value="th">🇹🇭 ไทย</option>
        <option value="vi">🇻🇳 Tiếng Việt</option>
        <option value="id">🇮🇩 Bahasa Indonesia</option>
        <option value="ms">🇲🇾 Bahasa Melayu</option>
      </select>
    </div>
  </div>
</main>

<style>
  main {
    width: 420px;
    min-height: 520px;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: linear-gradient(135deg, #0a0f1e 0%, #1a1f35 50%, #0f1624 100%);
    position: relative;
    overflow: hidden;
    color: #fff;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .glow-effect {
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.1) 0%,
      transparent 70%
    );
    animation: rotate 20s linear infinite;
    pointer-events: none;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Rain Animation */
  .rain-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }

  .raindrop {
    position: absolute;
    width: 2px;
    height: 20px;
    background: linear-gradient(to bottom, var(--color), transparent);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    left: calc(var(--i) * 10% + 5px);
    top: -20px;
    animation: rain calc(6s + var(--delay)) linear infinite;
    opacity: 0.4;
    filter: blur(0.5px);
  }

  @keyframes rain {
    0% {
      transform: translateY(0) scaleY(1);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateY(400px) scaleY(0.5);
      opacity: 0;
    }
  }

  .header {
    position: relative;
    padding: 32px 24px 24px;
    text-align: center;
    z-index: 1;
  }

  .logo-container {
    position: relative;
  }

  .logo-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 140px;
    height: 140px;
    background: radial-gradient(
      circle,
      rgba(99, 102, 241, 0.3) 0%,
      rgba(139, 92, 246, 0.2) 50%,
      transparent 70%
    );
    border-radius: 50%;
    animation: pulse 4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 0.8;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  .header h1 {
    margin: 0;
    font-size: 36px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    position: relative;
    text-shadow:
      0 4px 20px rgba(99, 102, 241, 0.5),
      0 2px 8px rgba(0, 0, 0, 0.3);
    letter-spacing: -0.5px;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }

  .logo-text {
    background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 50%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #94a3b8;
    margin-top: 6px;
    font-weight: 600;
  }

  .feature-card {
    background: rgba(30, 41, 59, 0.4);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 14px;
    padding: 20px;
    margin: 0 20px 18px;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    z-index: 1;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 32px rgba(99, 102, 241, 0.2),
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    background: rgba(30, 41, 59, 0.5);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }

  .icon-wrapper {
    width: 44px;
    height: 44px;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.2),
      rgba(139, 92, 246, 0.15)
    );
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .card-title {
    flex: 1;
    min-width: 0;
  }

  .card-title label {
    display: block;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 5px;
    cursor: pointer;
    color: #f1f5f9;
    letter-spacing: -0.2px;
  }

  .card-title small {
    display: block;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.5;
    font-weight: 400;
  }

  /* Language Selector */
  .language-selector {
    margin-top: 12px;
  }

  .selector-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #cbd5e1;
    letter-spacing: 0.3px;
  }

  .label-icon {
    font-size: 15px;
  }

  .modern-select {
    width: 100%;
    padding: 11px 16px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    color: #f1f5f9;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(12px);
    letter-spacing: 0.2px;
  }

  .modern-select:hover {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(99, 102, 241, 0.4);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
  }

  .modern-select:focus {
    outline: none;
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow:
      0 0 0 3px rgba(99, 102, 241, 0.15),
      0 2px 12px rgba(99, 102, 241, 0.2);
  }

  .modern-select option {
    background: #1e293b;
    color: #f1f5f9;
    padding: 12px;
    font-weight: 500;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 52px;
    height: 28px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(51, 65, 85, 0.6);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 28px;
    border: 1.5px solid rgba(148, 163, 184, 0.3);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 22px;
    width: 22px;
    left: 2px;
    bottom: 2px;
    background: linear-gradient(135deg, #f8fafc, #e2e8f0);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 50%;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.2),
      0 1px 2px rgba(0, 0, 0, 0.1);
  }

  input:checked + .slider {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border-color: rgba(34, 197, 94, 0.5);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 12px rgba(34, 197, 94, 0.4);
  }

  input:checked + .slider:before {
    transform: translateX(24px);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.25),
      0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .slider:hover {
    border-color: rgba(148, 163, 184, 0.5);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.15),
      0 2px 12px rgba(148, 163, 184, 0.15);
  }

  input:checked + .slider:hover {
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 18px rgba(34, 197, 94, 0.5),
      0 2px 12px rgba(34, 197, 94, 0.3);
  }

  /* 響應式調整 */
  @media (max-width: 400px) {
    main {
      width: 100%;
    }
  }
</style>
