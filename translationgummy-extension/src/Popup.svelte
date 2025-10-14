<script lang="ts">
  import { onMount } from 'svelte';

  // Using Svelte 5 Runes
  let readingEnabled = $state(false);
  let targetWriteLang = $state('en');
  let targetReadLang = $state('zh-TW');

  // On component mount, load settings from chrome.storage
  onMount(async () => {
    const result = await chrome.storage.sync.get(['readingEnabled', 'targetWriteLang', 'targetReadLang']);
    readingEnabled = result.readingEnabled ?? false;
    targetWriteLang = result.targetWriteLang ?? 'en';
    targetReadLang = result.targetReadLang ?? 'zh-TW';
  });

  // When toggle changes, save settings and notify Content Script
  function handleToggleChange() {
    chrome.storage.sync.set({ readingEnabled });
    // Notify current tab's Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: readingEnabled ? "translatePage" : "revertPage"
        });
      }
    });
  }

  // Auto-save language settings on change
  $effect(() => {
    chrome.storage.sync.set({ targetWriteLang, targetReadLang });
  });

</script>

<main>
  <h1>Gummy</h1>
  <div class="setting-row">
    <div>
      <label for="reading-toggle">Enable Immersive Reading</label>
      <small style="display: block; color: #666; font-size: 11px;">Display page content in bilingual mode</small>
    </div>
    <input type="checkbox" id="reading-toggle" bind:checked={readingEnabled} onchange={handleToggleChange} />
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
</style>
