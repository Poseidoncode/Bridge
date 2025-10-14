<script lang="ts">
  import { onMount } from "svelte";

  // Using Svelte 5 Runes
  let targetWriteLang = $state("en");
  let targetReadLang = $state("zh-Hant");
  let currentPageTranslated = $state(false);
  let userIntendedState = $state(false); // Track user's intended state

  // On component mount, load settings from chrome.storage
  onMount(async () => {
    const result = await chrome.storage.sync.get([
      "targetWriteLang",
      "targetReadLang",
    ]);
    targetWriteLang = result.targetWriteLang ?? "en";
    targetReadLang = result.targetReadLang ?? "zh-Hant";

    // Check current page translation status
    await checkCurrentPageStatus();
  });

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
      if (tabs[0] && tabs[0].id) {
        if (newState) {
          // If turning on, translate the page
          console.log("User wants to turn translation ON");
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: "translatePage",
          });
        } else {
          // If turning off, revert the page
          console.log("User wants to turn translation OFF");
          await chrome.tabs.sendMessage(tabs[0].id, { action: "revertPage" });
        }

        // Update UI to match user's intention immediately
        currentPageTranslated = newState;
        console.log("Updated UI to match user intention:", newState);

        // Don't automatically check status to avoid overriding user intention
        console.log("Translation request sent, UI state preserved");
      } else {
        console.error("No active tab found");
      }
    } catch (error) {
      console.error("Error in toggle change:", error);
      // Revert to actual state on error
      await checkCurrentPageStatus();
    }
  }

  // Check current page translation status
  async function checkCurrentPageStatus() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0] && tabs[0].id) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: "getPageTranslationStatus",
        });
        if (response) {
          currentPageTranslated = response.isTranslated;
        }
      }
    } catch (error) {
      currentPageTranslated = false;
    }
  }

  $effect(() => {
    chrome.storage.sync.set({ targetWriteLang, targetReadLang });
  });
</script>

<main>
  <div class="glow-effect"></div>

  <div class="header">
    <div class="logo-container">
      <div class="logo-glow"></div>
      <h1>
        <span class="logo-icon">🍬</span>
        <span class="logo-text">Gummy</span>
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
      <select id="read-lang" bind:value={targetReadLang} class="modern-select">
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
        class="modern-select"
      >
        <option value="en">🇬🇧 English</option>
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

  <div class="powered-by">
    <span class="ai-badge">
      <span class="badge-pulse"></span>
      Powered by Google AI
    </span>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }

  main {
    width: 360px;
    min-height: 480px;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    position: relative;
    overflow: hidden;
    color: #fff;
  }

  /* 動態光效背景 */
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

  /* Header 樣式 */
  .header {
    position: relative;
    padding: 28px 24px 20px;
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
    width: 120px;
    height: 120px;
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.3) 0%,
      transparent 70%
    );
    border-radius: 50%;
    animation: pulse 3s ease-in-out infinite;
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
    font-size: 32px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    position: relative;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  .logo-icon {
    font-size: 36px;
    animation: bounce 2s ease-in-out infinite;
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
    background: linear-gradient(135deg, #fff 0%, #f0f0f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.9;
    margin-top: 4px;
    font-weight: 500;
  }

  /* Feature Card 樣式 */
  .feature-card {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 18px;
    margin: 0 16px 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    position: relative;
    z-index: 1;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    background: rgba(255, 255, 255, 0.2);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }

  .icon-wrapper {
    width: 40px;
    height: 40px;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.3),
      rgba(255, 255, 255, 0.1)
    );
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .card-title {
    flex: 1;
    min-width: 0;
  }

  .card-title label {
    display: block;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
    cursor: pointer;
  }

  .card-title small {
    display: block;
    font-size: 11px;
    opacity: 0.85;
    line-height: 1.4;
  }

  /* Language Selector */
  .language-selector {
    margin-top: 12px;
  }

  .selector-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 8px;
    opacity: 0.95;
  }

  .label-icon {
    font-size: 14px;
  }

  .modern-select {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .modern-select:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .modern-select:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.35);
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }

  .modern-select option {
    background: #667eea;
    color: #fff;
    padding: 10px;
  }

  /* Switch Toggle - 升級版 */
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
    background: rgba(255, 255, 255, 0.25);
    transition: 0.4s;
    border-radius: 28px;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 2px;
    background: linear-gradient(135deg, #fff, #f0f0f0);
    transition: 0.4s;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  input:checked + .slider {
    background: linear-gradient(135deg, #4ade80, #22c55e);
    border-color: rgba(255, 255, 255, 0.5);
  }

  input:checked + .slider:before {
    transform: translateX(24px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  }

  .slider:hover {
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
  }

  input:checked + .slider:hover {
    box-shadow: 0 0 15px rgba(74, 222, 128, 0.5);
  }

  /* Powered By Badge */
  .powered-by {
    text-align: center;
    padding: 16px;
    position: relative;
    z-index: 1;
  }

  .ai-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    position: relative;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .badge-pulse {
    width: 8px;
    height: 8px;
    background: #4ade80;
    border-radius: 50%;
    animation: badge-pulse 2s ease-in-out infinite;
    box-shadow: 0 0 10px #4ade80;
  }

  @keyframes badge-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.2);
    }
  }

  /* 響應式調整 */
  @media (max-width: 400px) {
    main {
      width: 100%;
    }
  }
</style>
