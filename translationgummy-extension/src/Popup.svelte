<script lang="ts">
  import { onMount } from 'svelte';

  // Using Svelte 5 Runes
  let targetWriteLang = $state('en');
  let targetReadLang = $state('zh-TW');
  let currentPageTranslated = $state(false);

  // On component mount, load settings from chrome.storage
  onMount(async () => {
    const result = await chrome.storage.sync.get(['targetWriteLang', 'targetReadLang']);
    targetWriteLang = result.targetWriteLang ?? 'en';
    targetReadLang = result.targetReadLang ?? 'zh-TW';

    // Check current page translation status
    await checkCurrentPageStatus();
  });

  // Handle translate button click
  async function handleTranslate() {
    console.log('Translate button clicked, sending message to content script...');
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id) {
        console.log(`Sending translatePage message to tab ${tabs[0].id}`);
        await chrome.tabs.sendMessage(tabs[0].id, { action: "translatePage" });
        console.log('translatePage message sent successfully');
        setTimeout(() => {
          console.log('Checking status after translation...');
          checkCurrentPageStatus();
        }, 500);
      } else {
        console.error('No active tab found');
      }
    } catch (error) {
      console.error('Error sending translate message:', error);
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

  // Check current page translation status
  async function checkCurrentPageStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: "getPageTranslationStatus"
        });
        if (response) {
          currentPageTranslated = response.isTranslated;
        }
      }
    } catch (error) {
      currentPageTranslated = false;
    }
  }

  // Auto-save language settings on change
  $effect(() => {
    chrome.storage.sync.set({ targetWriteLang, targetReadLang });
  });

</script>

<main>
  <div class="header">
    <h1>Gummy</h1>
    <div class="status-indicator" class:translated={currentPageTranslated}>
      {currentPageTranslated ? '已翻譯' : '未翻譯'}
    </div>
  </div>
  <div class="setting-row">
    <div>
      <label>Page Translation</label>
      <small style="display: block; color: #666; font-size: 11px;">Translate current page content</small>
    </div>
    <div class="button-group">
      <button
        class="action-button translate-btn"
        disabled={currentPageTranslated}
        onclick={handleTranslate}
      >
        {currentPageTranslated ? '已翻譯' : '翻譯'}
      </button>
      <button
        class="action-button revert-btn"
        disabled={!currentPageTranslated}
        onclick={handleRevert}
      >
        還原
      </button>
    </div>
  </div>
  <div class="setting-row">
    <div>
      <label for="write-lang">Writing Target Language</label>
      <small style="display: block; color: #666; font-size: 11px;">Select the language to translate input text into</small>
    </div>
    <select id="write-lang" bind:value={targetWriteLang}>
      <option value="en">English</option>
      <option value="ja">日本語</option>
      <option value="ko">한국어</option>
      <option value="fr">Français</option>
      <option value="de">Deutsch</option>
      <option value="es">Español</option>
      <option value="it">Italiano</option>
      <option value="pt">Português</option>
      <option value="ru">Русский</option>
      <option value="ar">العربية</option>
      <option value="hi">हिन्दी</option>
      <option value="th">ไทย</option>
      <option value="vi">Tiếng Việt</option>
      <option value="id">Bahasa Indonesia</option>
      <option value="ms">Bahasa Melayu</option>
    </select>
  </div>
  <div class="setting-row">
    <div>
      <label for="read-lang">Reading Target Language</label>
      <small style="display: block; color: #666; font-size: 11px;">Select the language to translate pages into</small>
    </div>
    <select id="read-lang" bind:value={targetReadLang}>
      <option value="en">English</option>
      <option value="zh-TW">繁體中文</option>
      <option value="zh-CN">简体中文</option>
      <option value="ja">日本語</option>
      <option value="ko">한국어</option>
      <option value="fr">Français</option>
      <option value="de">Deutsch</option>
      <option value="es">Español</option>
      <option value="it">Italiano</option>
      <option value="pt">Português</option>
      <option value="ru">Русский</option>
      <option value="ar">العربية</option>
      <option value="hi">हिन्दी</option>
      <option value="th">ไทย</option>
      <option value="vi">Tiếng Việt</option>
      <option value="id">Bahasa Indonesia</option>
      <option value="ms">Bahasa Melayu</option>
    </select>
  </div>
</main>

<style>
  main {
    width: 250px;
    padding: 10px;
    font-family: sans-serif;
  }
  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
  }
  label {
    font-size: 14px;
  }
  select, input {
    font-size: 14px;
  }
  .button-group {
    display: flex;
    gap: 8px;
  }
  .action-button {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f8f9fa;
    color: #333;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
  }
  .action-button:hover:not(:disabled) {
    background: #e9ecef;
    border-color: #adb5bd;
  }
  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #e9ecef;
    color: #6c757d;
  }
  .action-button.translate-btn:not(:disabled) {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }
  .action-button.translate-btn:not(:disabled):hover {
    background: #0056b3;
    border-color: #0056b3;
  }
  .action-button.revert-btn:not(:disabled) {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
  }
  .action-button.revert-btn:not(:disabled):hover {
    background: #c82333;
    border-color: #c82333;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  }
  .status-indicator {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 12px;
    font-weight: 500;
    transition: all 0.3s ease;
  }
  .status-indicator:not(.translated) {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
  }
  .status-indicator.translated {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }
</style>
