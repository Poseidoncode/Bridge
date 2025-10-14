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
  <h1>TranslationGummy</h1>
  <div class="setting-row">
    <label for="reading-toggle">Enable Immersive Reading</label>
    <input type="checkbox" id="reading-toggle" bind:checked={readingEnabled} onchange={handleToggleChange} />
  </div>
  <div class="setting-row">
    <label for="write-lang">Writing Target Language</label>
    <select id="write-lang" bind:value={targetWriteLang}>
      <option value="en">English</option>
      <option value="ja">Japanese</option>
      <option value="ko">Korean</option>
    </select>
  </div>
  <div class="setting-row">
    <label for="read-lang">Reading Target Language</label>
    <select id="read-lang" bind:value={targetReadLang}>
      <option value="zh-TW">Traditional Chinese</option>
      <option value="zh-CN">Simplified Chinese</option>
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
