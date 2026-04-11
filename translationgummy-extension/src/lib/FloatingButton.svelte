<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import QuickMenu from './QuickMenu.svelte';

  interface Props {
    onClick: () => void;
    onToggle: () => void;
    isTranslationEnabled: boolean;
  }

  let { onClick, onToggle, isTranslationEnabled }: Props = $props();

  let isMenuOpen = $state(false);
  let currentReadLang = $state('zh-Hant');
  let currentWriteLang = $state('en');

  // Load saved language settings
  onMount(async () => {
    try {
      const settings = await chrome.storage.sync.get(['targetReadLang', 'targetWriteLang']);
      currentReadLang = settings.targetReadLang || 'zh-Hant';
      currentWriteLang = settings.targetWriteLang || 'en';
    } catch (error) {
      console.error('Failed to load language settings:', error);
    }
  });

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    isMenuOpen = !isMenuOpen;
    if (isMenuOpen) {
      onClick();
    }
  }

  function handleToggle(e: MouseEvent) {
    e.stopPropagation();
    onToggle();
  }

  function closeMenu() {
    isMenuOpen = false;
  }

  async function handleReadLangChange(lang: string) {
    currentReadLang = lang;
    try {
      await chrome.storage.sync.set({ targetReadLang: lang });
    } catch (error) {
      console.error('Failed to save read language:', error);
    }
  }

  async function handleWriteLangChange(lang: string) {
    currentWriteLang = lang;
    try {
      await chrome.storage.sync.set({ targetWriteLang: lang });
    } catch (error) {
      console.error('Failed to save write language:', error);
    }
  }

  function handleRevertPage() {
    chrome.runtime.sendMessage({ action: 'revertPage' });
    closeMenu();
  }

  function handleOpenSettings() {
    chrome.runtime.sendMessage({ action: 'openPopup' });
    closeMenu();
  }

  // Close menu when clicking outside
  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.translationbridge-floating-button')) {
      closeMenu();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleOutsideClick);
  });
</script>

<div class="translationbridge-floating-button" class:open={isMenuOpen}>
  <!-- Main circular button -->
  <button
    class="floating-trigger"
    onclick={handleClick}
    title="Translation Bridge"
  >
    <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
      <text x="12" y="16" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">A</text>
    </svg>
  </button>

  <!-- Quick Menu -->
  <QuickMenu
    visible={isMenuOpen}
    onClose={closeMenu}
    onToggleTranslation={handleToggle}
    onRevertPage={handleRevertPage}
    onOpenSettings={handleOpenSettings}
    onReadLangChange={handleReadLangChange}
    onWriteLangChange={handleWriteLangChange}
    currentReadLang={currentReadLang}
    currentWriteLang={currentWriteLang}
    isTranslationEnabled={isTranslationEnabled}
  />
</div>

<style>
  .translationbridge-floating-button {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .floating-trigger {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    color: white;
  }

  .floating-trigger:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .floating-trigger:active {
    transform: scale(0.95);
  }

  .icon {
    width: 28px;
    height: 28px;
  }
</style>
