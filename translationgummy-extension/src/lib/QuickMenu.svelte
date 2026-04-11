<script lang="ts">
  interface Props {
    visible: boolean;
    onClose: () => void;
    onToggleTranslation: () => void;
    onRevertPage: () => void;
    onOpenSettings: () => void;
    onReadLangChange: (lang: string) => void;
    onWriteLangChange: (lang: string) => void;
    currentReadLang: string;
    currentWriteLang: string;
    isTranslationEnabled: boolean;
  }

  let {
    visible,
    onClose,
    onToggleTranslation,
    onRevertPage,
    onOpenSettings,
    onReadLangChange,
    onWriteLangChange,
    currentReadLang,
    currentWriteLang,
    isTranslationEnabled
  }: Props = $props();

  let activeTab = $state<'read' | 'write'>('read');

  const languages = [
    { code: 'en', name: 'English', flag: '🇬' },
    { code: 'zh-Hant', name: '繁體中文', flag: '🇹🇼' },
    { code: 'zh-Hans', name: '简体中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ar', name: 'العربية', flag: '🇸' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'th', name: 'ไทย', flag: '🇹🇭' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' }
  ];

  function handleReadLangChange(lang: string) {
    onReadLangChange(lang);
  }

  function handleWriteLangChange(lang: string) {
    onWriteLangChange(lang);
  }
</script>

{#if visible}
  <div class="quick-menu-overlay" onclick={onClose} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && onClose()}>
    <div class="quick-menu" role="dialog" aria-label="Quick settings menu">
      <!-- Header -->
      <div class="menu-header">
        <div class="header-title">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
            <text x="12" y="16" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">A</text>
          </svg>
          <span>Translation Bridge</span>
        </div>
        <button class="close-btn" onclick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
      </div>

      <!-- Toggle Switch -->
      <div class="menu-section">
        <label class="toggle-row">
          <span class="toggle-label">翻譯開關</span>
          <div class="toggle-switch" onclick={(e) => { e.stopPropagation(); onToggleTranslation(); }} role="button" tabindex="0" onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') onToggleTranslation(); }}>
            <input
              type="checkbox"
              checked={isTranslationEnabled}
            />
            <span class="slider"></span>
          </div>
        </label>
      </div>

      <!-- Language Selection Tabs -->
      <div class="menu-section">
        <div class="tabs">
          <button
            class="tab"
            class:active={activeTab === 'read'}
            onclick={(e) => { e.stopPropagation(); activeTab = 'read'; }}
          >
            📖 閱讀語言
          </button>
          <button
            class="tab"
            class:active={activeTab === 'write'}
            onclick={(e) => { e.stopPropagation(); activeTab = 'write'; }}
          >
            ✍️ 寫作語言
          </button>
        </div>

        <div class="language-list">
          {#if activeTab === 'read'}
            <div class="lang-grid">
              {#each languages as lang}
                <button
                  class="lang-item"
                  class:active={currentReadLang === lang.code}
                  onclick={(e) => { e.stopPropagation(); handleReadLangChange(lang.code); }}
                >
                  <span class="lang-flag">{lang.flag}</span>
                  <span class="lang-name">{lang.name}</span>
                  {#if currentReadLang === lang.code}
                    <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {:else}
            <div class="lang-grid">
              {#each languages as lang}
                <button
                  class="lang-item"
                  class:active={currentWriteLang === lang.code}
                  onclick={(e) => { e.stopPropagation(); handleWriteLangChange(lang.code); }}
                >
                  <span class="lang-flag">{lang.flag}</span>
                  <span class="lang-name">{lang.name}</span>
                  {#if currentWriteLang === lang.code}
                    <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="menu-section">
        <button class="action-btn revert" onclick={(e) => { e.stopPropagation(); onRevertPage(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          <span>還原頁面</span>
        </button>
        
        <button class="action-btn settings" onclick={(e) => { e.stopPropagation(); onOpenSettings(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <span>完整設定</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483646;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 20px;
  }

  .quick-menu {
    position: relative;
    width: 380px;
    max-height: 600px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.2s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
    font-size: 16px;
  }

  .logo-icon {
    width: 24px;
    height: 24px;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 28px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .menu-section {
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
  }

  .menu-section:last-child {
    border-bottom: none;
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .toggle-label {
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }

  .toggle-switch {
    position: relative;
    cursor: pointer;
  }

  .toggle-switch input {
    display: none;
  }

  .slider {
    position: relative;
    width: 48px;
    height: 26px;
    background: #ccc;
    border-radius: 26px;
    transition: background 0.3s;
    display: block;
  }

  .slider:before {
    content: '';
    position: absolute;
    width: 22px;
    height: 22px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.3s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  input:checked + .slider {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  input:checked + .slider:before {
    transform: translateX(22px);
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .tab {
    flex: 1;
    padding: 10px 16px;
    border: 2px solid #e0e0e0;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #666;
    transition: all 0.2s;
  }

  .tab:hover {
    border-color: #667eea;
    color: #667eea;
  }

  .tab.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
    color: white;
  }

  .language-list {
    max-height: 280px;
    overflow-y: auto;
  }

  .lang-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .lang-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border: 2px solid #e0e0e0;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .lang-item:hover {
    border-color: #667eea;
    background: #f8f9ff;
  }

  .lang-item.active {
    border-color: #667eea;
    background: linear-gradient(135deg, #f0f2ff 0%, #f5f0ff 100%);
  }

  .lang-flag {
    font-size: 20px;
  }

  .lang-name {
    flex: 1;
    font-size: 13px;
    color: #333;
    font-weight: 500;
  }

  .check-icon {
    width: 18px;
    height: 18px;
    color: #667eea;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e0e0e0;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    font-weight: 500;
    transition: all 0.2s;
    margin-bottom: 8px;
  }

  .action-btn:last-child {
    margin-bottom: 0;
  }

  .action-btn:hover {
    border-color: #667eea;
    background: #f8f9ff;
  }

  .action-btn svg {
    width: 20px;
    height: 20px;
  }

  .action-btn.revert:hover {
    border-color: #ff6b6b;
    background: #fff5f5;
    color: #ff6b6b;
  }

  .action-btn.settings:hover {
    border-color: #667eea;
    background: #f0f2ff;
    color: #667eea;
  }
</style>
