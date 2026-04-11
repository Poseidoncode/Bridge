<script lang="ts">
  import { searchLanguages, getLanguageByCode, SUPPORTED_LANGUAGES } from './languages';
  import type { Language } from './types';

  let {
    value = $bindable(),
    label,
    labelIcon,
    onchange
  } = $props<{
    value: string;
    label: string;
    labelIcon: string;
    onchange?: (event: Event) => void;
  }>();

  let isOpen = $state(false);
  let searchQuery = $state('');
  
  let filteredLanguages = $derived(searchLanguages(searchQuery));
  let selectedLanguage = $derived(getLanguageByCode(value) || SUPPORTED_LANGUAGES[0]);

  function handleSelect(lang: Language) {
    value = lang.code;
    isOpen = false;
    searchQuery = '';
    
    // Fire onchange event
    if (onchange) {
      // @ts-ignore - Svelte typing quirk for synthetic events
      onchange({ target: { value: lang.code } } as unknown as Event);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      isOpen = !isOpen;
      if (isOpen) {
        setTimeout(() => {
          document.getElementById('search-input')?.focus();
        }, 10);
      }
    } else if (event.key === 'Escape') {
      isOpen = false;
    }
  }

  function handleInputKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' && filteredLanguages.length > 0) {
      event.preventDefault();
      // Simple implementation: focus first option if available
      // A full implementation would manage active index state
      const firstOption = document.querySelector('.language-option') as HTMLElement;
      firstOption?.focus();
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent, lang: Language, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(lang);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const options = document.querySelectorAll('.language-option');
      const nextOption = options[index + 1] as HTMLElement;
      nextOption?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0) {
        document.getElementById('search-input')?.focus();
      } else {
        const options = document.querySelectorAll('.language-option');
        const prevOption = options[index - 1] as HTMLElement;
        prevOption?.focus();
      }
    } else if (event.key === 'Escape') {
      isOpen = false;
      document.getElementById('search-input')?.focus();
    }
  }
</script>

<div class="language-selector-container">
  <span class="control-label" id={`label-${label.replace(/\s+/g, '-').toLowerCase()}`}>
    <span class="icon">{labelIcon}</span> {label}
  </span>
  
  <div class="selector-relative">
    <div 
      class="modern-select selector-trigger" 
      role="combobox"
      aria-expanded={isOpen}
      aria-controls="language-listbox"
      aria-labelledby={`label-${label.replace(/\s+/g, '-').toLowerCase()}`}
      tabindex="0"
      onclick={() => {
        isOpen = !isOpen;
        if (isOpen) {
          setTimeout(() => {
            document.getElementById('search-input')?.focus();
          }, 10);
        }
      }}
      onkeydown={handleKeyDown}
    >
      <span>{selectedLanguage.flag} {selectedLanguage.name}</span>
      <span class="dropdown-arrow">▼</span>
    </div>

    {#if isOpen}
      <div class="dropdown-menu">
        <div class="search-container">
          <input 
            id="search-input"
            type="text" 
            placeholder="Search languages..." 
            bind:value={searchQuery}
            onkeydown={handleInputKeyDown}
            class="search-input"
            data-autofocus
          />
        </div>
        
        <ul id="language-listbox" class="language-list" role="listbox">
          {#each filteredLanguages as lang, index}
            <li 
              class="language-option" 
              class:selected={lang.code === value}
              role="option" 
              aria-selected={lang.code === value}
              tabindex="-1"
              onclick={() => handleSelect(lang)}
              onkeydown={(e) => handleOptionKeyDown(e, lang, index)}
            >
              <span>{lang.flag} {lang.name}</span>
              {#if lang.code === value}
                <span class="check-icon">✓</span>
              {/if}
            </li>
          {/each}
          
          {#if filteredLanguages.length === 0}
            <li class="no-results">No languages found</li>
          {/if}
        </ul>
      </div>
    {/if}
  </div>
</div>

<style>
  .language-selector-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    z-index: 10;
  }

  .control-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--text-secondary, #a1a1aa);
    font-weight: 500;
  }

  .selector-relative {
    position: relative;
  }

  .selector-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    width: 100%;
    background: var(--bg-tertiary, #27272a);
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text-primary, #f4f4f5);
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .selector-trigger:hover, .selector-trigger:focus {
    border-color: var(--accent-primary, #6366f1);
    outline: none;
  }

  .dropdown-arrow {
    font-size: 10px;
    color: var(--text-secondary, #a1a1aa);
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-tertiary, #27272a);
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    z-index: 100;
    max-height: 250px;
    display: flex;
    flex-direction: column;
  }

  .search-container {
    padding: 8px;
    border-bottom: 1px solid var(--border-color, #3f3f46);
  }

  .search-input {
    width: 100%;
    background: var(--bg-primary, #18181b);
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--text-primary, #f4f4f5);
    font-size: 14px;
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-primary, #6366f1);
  }

  .language-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    flex: 1;
  }

  .language-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary, #f4f4f5);
  }

  .language-option:hover, .language-option:focus {
    background: var(--bg-hover, #3f3f46);
    outline: none;
  }

  .language-option.selected {
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent-primary, #818cf8);
  }

  .check-icon {
    font-weight: bold;
  }

  .no-results {
    padding: 12px;
    text-align: center;
    color: var(--text-secondary, #a1a1aa);
    font-size: 14px;
  }
</style>
