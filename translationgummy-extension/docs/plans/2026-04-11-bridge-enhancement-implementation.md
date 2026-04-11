# Bridge Extension Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement user-friendly enhancements to the Bridge browser extension including improved feedback systems, enhanced UI, better Smart Input controls, translation quality options, and performance improvements while maintaining privacy-first on-device translation.

**Architecture:** CRITICAL CONSTRAINT: Content scripts run in web page context where Svelte does not exist. All content-script UI must be **pure TypeScript + DOM manipulation**. Svelte components are only valid in the popup (`Popup.svelte`). Modular approach with separate files for each enhancement.

**Tech Stack:** Svelte 5, TypeScript, Chrome Extension Manifest V3, Vite, Vitest for testing.

---

## Dependency Graph

```
Wave 0 (Foundation - 3 parallel tasks, no dependencies)
  T1: Shared types, constants, languages
  T2: NotificationManager (pure TS)
  T3: SiteExclusionManager

Wave 1 (Integration - 3 parallel tasks, depends on Wave 0)
  T4: Integrate notifications into content.ts [depends: T2]
  T5: LanguageSelector.svelte [depends: T1]
  T6: StatusIndicator.svelte [depends: T1]

Wave 2 (Features - 3 parallel tasks, depends on Wave 0-1)
  T7: Smart Input context menu + discoverability [depends: T1, T4]
  T8: SettingsPanel.svelte with exclusions [depends: T3, T5]
  T9: ShortcutManager [depends: T1]

Wave 3 (Performance - 2 parallel tasks, depends on Wave 0)
  T10: Viewport-based lazy translation [depends: T1]
  T11: Translation LRU cache [depends: T1]

Wave 4 (Validation - 1 task, depends on all)
  T12: Integration tests
```

---

## Wave 0: Foundation Tasks

### T1: Shared Modules (types, constants, languages)

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/constants.ts`
- Create: `src/lib/languages.ts`
- Test: `tests/unit/shared-modules.test.ts`

**Implementation:**

`src/lib/types.ts`:
```typescript
export interface NotificationOptions {
  id?: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  persistent?: boolean;
  duration?: number;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface SiteExclusion {
  pattern: string;
  addedAt: number;
}

export interface TranslationCacheEntry {
  translation: string;
  timestamp: number;
}

export interface ShortcutConfig {
  smartInput: string;
  translatePage: string;
  revertPage: string;
}
```

`src/lib/constants.ts`:
```typescript
export const CSS_CLASSES = {
  TRANSLATION_WRAPPER: 'translationbridge-translation-wrapper',
  TRANSLATION_CONTENT: 'translationbridge-translation-content',
  TRANSLATED: 'translationbridge-translated',
  INLINE_TRANSLATED: 'translationbridge-inline-translated',
  NOTIFICATION: 'translationbridge-notification',
  NOTIFICATION_INFO: 'translationbridge-notification-info',
  NOTIFICATION_SUCCESS: 'translationbridge-notification-success',
  NOTIFICATION_ERROR: 'translationbridge-notification-error',
  NOTIFICATION_WARNING: 'translationbridge-notification-warning',
  LOADING: 'translationbridge-loading',
};

export const ELEMENT_IDS = {
  NOTIFICATION_CONTAINER: 'translationbridge-notification-container',
  LOADING: 'translationbridge-loading',
  SMART_INPUT_STATUS: 'translationbridge-smart-input-status',
  SMART_INPUT_HINT: 'translationbridge-smart-input-hint',
};

export const STORAGE_KEYS = {
  TARGET_READ_LANG: 'targetReadLang',
  TARGET_WRITE_LANG: 'targetWriteLang',
  SITE_EXCLUSIONS: 'siteExclusions',
  SHORTCUT_CONFIG: 'shortcutConfig',
  TRANSLATION_TOGGLE_BY_TAB: 'translationToggleStateByTab',
  TRANSLATION_TOGGLE: 'translationToggleState',
};

export const DATA_ATTRIBUTES = {
  INJECTED: 'translationbridgeInjected',
  ORIGINAL: 'translationbridgeOriginal',
  ORIGINAL_INLINE: 'translationbridgeOriginalInline',
};

export const DEFAULTS = {
  TARGET_READ_LANG: 'zh-Hant',
  TARGET_WRITE_LANG: 'en',
  NOTIFICATION_DURATION: 3200,
  CACHE_MAX_SIZE: 500,
  CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes
};
```

`src/lib/languages.ts`:
```typescript
import type { Language } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh-Hant', name: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
];

export function searchLanguages(query: string): Language[] {
  const lowerQuery = query.toLowerCase();
  return SUPPORTED_LANGUAGES.filter(lang =>
    lang.code.toLowerCase().includes(lowerQuery) ||
    lang.name.toLowerCase().includes(lowerQuery)
  );
}

export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}
```

**Test:** `tests/unit/shared-modules.test.ts`
- Test types are properly exported
- Test constants have correct values
- Test SUPPORTED_LANGUAGES array length
- Test searchLanguages returns correct results

**Commit:** Two atomic commits
```
test: add tests for shared modules (types, constants, languages)
feat: implement shared modules foundation
```

---

### T2: NotificationManager (Pure TypeScript)

**Files:**
- Create: `src/lib/notifications.ts`
- Test: `tests/unit/notifications.test.ts`

**Implementation:**

`src/lib/notifications.ts`:
```typescript
import { CSS_CLASSES, ELEMENT_IDS, DEFAULTS } from './constants';
import type { NotificationOptions } from './types';

export class NotificationManager {
  private container: HTMLElement | null = null;
  private activeNotifications: Map<string, HTMLElement> = new Map();
  private timers: Map<string, number> = new Map();

  constructor() {
    this.ensureContainer();
  }

  private ensureContainer(): HTMLElement {
    if (!this.container || !this.container.isConnected) {
      this.container = document.createElement('div');
      this.container.id = ELEMENT_IDS.NOTIFICATION_CONTAINER;
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: auto;
      `;
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(options: NotificationOptions): string {
    const id = options.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = options.duration ?? DEFAULTS.NOTIFICATION_DURATION;

    // Remove existing notification with same id
    if (this.activeNotifications.has(id)) {
      this.dismiss(id);
    }

    const notification = document.createElement('div');
    notification.className = `${CSS_CLASSES.NOTIFICATION} ${CSS_CLASSES[`NOTIFICATION_${options.type.toUpperCase()}`] || CSS_CLASSES.NOTIFICATION_INFO}`;
    notification.dataset.notificationId = id;
    notification.style.cssText = `
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-radius: 8px;
      min-width: 280px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.setAttribute('role', options.type === 'error' ? 'alert' : 'status');

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; margin-right: 12px;';
    content.textContent = options.message;
    notification.appendChild(content);

    // Close button (if not persistent)
    if (!options.persistent) {
      const closeBtn = document.createElement('button');
      closeBtn.style.cssText = `
        background: transparent;
        border: none;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      closeBtn.textContent = '×';
      closeBtn.onclick = () => this.dismiss(id);
      notification.appendChild(closeBtn);
    }

    // Type-specific styling
    const typeStyles = {
      info: { bg: 'rgba(30, 64, 175, 0.9)', border: '#2563eb' },
      success: { bg: 'rgba(21, 128, 61, 0.9)', border: '#15803d' },
      error: { bg: 'rgba(185, 28, 28, 0.9)', border: '#b91c1c' },
      warning: { bg: 'rgba(180, 83, 9, 0.9)', border: '#d97706' },
    };
    const style = typeStyles[options.type] || typeStyles.info;
    notification.style.background = style.bg;
    notification.style.color = 'white';
    notification.style.borderLeft = `4px solid ${style.border}`;

    this.ensureContainer().appendChild(notification);
    this.activeNotifications.set(id, notification);

    // Auto-dismiss timer
    if (!options.persistent) {
      const timer = window.setTimeout(() => this.dismiss(id), duration);
      this.timers.set(id, timer);
    }

    return id;
  }

  dismiss(id: string): void {
    const notification = this.activeNotifications.get(id);
    if (notification) {
      // Clear timer
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }

      // Fade out animation
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => {
        notification.remove();
        this.activeNotifications.delete(id);
      }, 300);
    }
  }

  clearAll(): void {
    for (const id of this.activeNotifications.keys()) {
      this.dismiss(id);
    }
  }

  destroy(): void {
    this.clearAll();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  // Singleton pattern for content script usage
  private static instance: NotificationManager | null = null;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  static resetInstance(): void {
    if (NotificationManager.instance) {
      NotificationManager.instance.destroy();
      NotificationManager.instance = null;
    }
  }
}

// Add CSS animation styles to document
function injectAnimationStyles(): void {
  const styleId = 'translationbridge-notification-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Initialize on first import
injectAnimationStyles();
```

**Test:** `tests/unit/notifications.test.ts`
- Test show creates notification DOM element
- Test dismiss removes notification
- Test clearAll removes all
- Test auto-dismiss timer
- Test persistent notifications don't auto-dismiss
- Test type-specific styling

**Commit:**
```
test: add tests for NotificationManager
feat: implement NotificationManager (pure TS)
```

---

### T3: SiteExclusionManager

**Files:**
- Create: `src/lib/siteExclusions.ts`
- Test: `tests/unit/site-exclusions.test.ts`

**Implementation:**

`src/lib/siteExclusions.ts`:
```typescript
import { STORAGE_KEYS } from './constants';
import type { SiteExclusion } from './types';

export class SiteExclusionManager {
  private exclusions: SiteExclusion[] = [];
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadFromStorage();
    await this.initPromise;
    this.initPromise = null;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get([STORAGE_KEYS.SITE_EXCLUSIONS]);
      this.exclusions = result[STORAGE_KEYS.SITE_EXCLUSIONS] || [];
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load site exclusions:', error);
      this.exclusions = [];
      this.initialized = true;
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.SITE_EXCLUSIONS]: this.exclusions });
    } catch (error) {
      console.error('Failed to save site exclusions:', error);
      throw error;
    }
  }

  async getAll(): Promise<SiteExclusion[]> {
    await this.initialize();
    return [...this.exclusions];
  }

  async add(pattern: string): Promise<void> {
    await this.initialize();

    // Normalize pattern
    const normalized = this.normalizePattern(pattern);

    // Check for duplicates
    if (this.exclusions.some(e => e.pattern === normalized)) {
      throw new Error('Pattern already exists in exclusions');
    }

    this.exclusions.push({
      pattern: normalized,
      addedAt: Date.now(),
    });

    await this.saveToStorage();
  }

  async remove(pattern: string): Promise<void> {
    await this.initialize();

    const normalized = this.normalizePattern(pattern);
    const index = this.exclusions.findIndex(e => e.pattern === normalized);

    if (index === -1) {
      throw new Error('Pattern not found in exclusions');
    }

    this.exclusions.splice(index, 1);
    await this.saveToStorage();
  }

  isExcluded(url: string): boolean {
    if (!this.initialized || this.exclusions.length === 0) return false;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      for (const exclusion of this.exclusions) {
        // Domain match (exact or wildcard)
        if (this.matchesPattern(hostname, exclusion.pattern)) {
          return true;
        }

        // Full URL pattern match
        if (this.matchesPattern(url, exclusion.pattern)) {
          return true;
        }
      }

      return false;
    } catch {
      // Invalid URL, not excluded
      return false;
    }
  }

  private normalizePattern(pattern: string): string {
    return pattern.trim().toLowerCase();
  }

  private matchesPattern(value: string, pattern: string): boolean {
    const lowerValue = value.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    // Wildcard match (*.example.com)
    if (lowerPattern.startsWith('*.')) {
      const domain = lowerPattern.slice(2);
      return lowerValue === domain || lowerValue.endsWith('.' + domain);
    }

    // Exact match
    if (lowerValue === lowerPattern) return true;

    // Subdomain match (example.com matches sub.example.com)
    if (lowerValue.endsWith('.' + lowerPattern)) return true;

    // Simple contains (for URL patterns)
    if (lowerPattern.includes('/')) {
      return lowerValue.includes(lowerPattern);
    }

    return false;
  }

  // Singleton pattern
  private static instance: SiteExclusionManager | null = null;

  static getInstance(): SiteExclusionManager {
    if (!SiteExclusionManager.instance) {
      SiteExclusionManager.instance = new SiteExclusionManager();
    }
    return SiteExclusionManager.instance;
  }

  static resetInstance(): void {
    SiteExclusionManager.instance = null;
  }
}
```

**Test:** `tests/unit/site-exclusions.test.ts`
- Test add/remove patterns
- Test isExcluded with various URL patterns
- Test wildcard patterns (*.example.com)
- Test storage persistence
- Test duplicate handling

**Commit:**
```
test: add tests for SiteExclusionManager
feat: implement SiteExclusionManager
```

---

## Wave 1: Integration Tasks

### T4: Integrate Notifications into content.ts

**Files:**
- Modify: `src/content.ts`

**Changes:**
1. Import NotificationManager at top
2. Replace `showSmartInputStatus` implementation to use NotificationManager
3. Replace loading indicator creation (`#translationbridge-loading`) with NotificationManager
4. Replace error toast in `translatePage` catch block with NotificationManager
5. Add message handler for `showNotification` action

**Commit:**
```
test: add tests for content notification integration
refactor: integrate NotificationManager into content.ts
```

---

### T5: LanguageSelector.svelte Component

**Files:**
- Create: `src/lib/LanguageSelector.svelte`
- Modify: `src/Popup.svelte` (replace hardcoded `<select>` blocks at lines 383-399 and 427-443)
- Test: `tests/unit/language-selector.test.ts`

**Implementation:**
Searchable/filterable language dropdown with autocomplete.

**Commit:**
```
test: add tests for LanguageSelector component
feat: implement LanguageSelector.svelte with search
refactor: replace hardcoded language selects in Popup
```

---

### T6: StatusIndicator.svelte Component

**Files:**
- Create: `src/lib/StatusIndicator.svelte`
- Modify: `src/Popup.svelte`
- Test: `tests/unit/status-indicator.test.ts`

**Implementation:**
Visual indicator showing current translation state per tab (on/off/downloading).

**Commit:**
```
test: add tests for StatusIndicator component
feat: implement StatusIndicator.svelte
refactor: add status indicator to Popup
```

---

## Wave 2: Feature Tasks

### T7: Smart Input Discoverability

**Files:**
- Modify: `src/content.ts`

**Changes:**
1. Add visual border glow on focused input fields
2. Add context menu integration (right-click "Translate with Bridge")
3. Add hover tooltip showing shortcut

**Commit:**
```
test: add tests for Smart Input discoverability
feat: add visual indicators and context menu for Smart Input
```

---

### T8: SettingsPanel.svelte

**Files:**
- Create: `src/lib/SettingsPanel.svelte`
- Modify: `src/Popup.svelte`
- Test: `tests/unit/settings-panel.test.ts`

**Implementation:**
Settings panel with:
- Site exclusions list (uses SiteExclusionManager)
- Shortcut configuration
- Quality presets

**Commit:**
```
test: add tests for SettingsPanel component
feat: implement SettingsPanel.svelte with exclusions UI
refactor: add settings panel to Popup
```

---

### T9: ShortcutManager

**Files:**
- Create: `src/lib/shortcutManager.ts`
- Modify: `src/content.ts` (replace hardcoded Shift+S at line 677)
- Test: `tests/unit/shortcut-manager.test.ts`

**Implementation:**
Configurable keyboard shortcuts stored in chrome.storage.sync.

**Commit:**
```
test: add tests for ShortcutManager
feat: implement ShortcutManager with configurable shortcuts
refactor: replace hardcoded Shift+S shortcut
```

---

## Wave 3: Performance Tasks

### T10: Viewport-based Lazy Translation

**Files:**
- Create: `src/lib/viewportTranslation.ts`
- Modify: `src/content.ts` (translatePage function)
- Test: `tests/unit/viewport-translation.test.ts`

**Implementation:**
Use IntersectionObserver to prioritize visible elements.

**Commit:**
```
test: add tests for viewport translation
feat: implement viewport-based lazy translation
refactor: integrate viewport manager into translatePage
```

---

### T11: Translation LRU Cache

**Files:**
- Create: `src/lib/translationCache.ts`
- Modify: `src/content.ts` (translation pipeline)
- Test: `tests/unit/translation-cache.test.ts`

**Implementation:**
LRU cache with max 500 entries, 30-min TTL. Key: `${sourceLang}:${targetLang}:${textHash}`.

**Commit:**
```
test: add tests for translation cache
feat: implement LRU translation cache
refactor: integrate cache into translation pipeline
```

---

## Wave 4: Validation

### T12: Integration Tests

**Files:**
- Create: `tests/unit/integration.test.ts`

**Test Coverage:**
- Full notification flow (popup -> content -> notification display)
- Site exclusion prevents translation
- Shortcut triggers Smart Input
- Language change triggers re-translation
- Cache reduces redundant translations

**Commit:**
```
test: add integration tests for all enhancement features
```

---

## Execution Strategy

Each task follows TDD:
1. Write failing test
2. Run test → confirm FAIL
3. Implement minimal code
4. Run test → confirm PASS
5. Commit (test commit, then feat/refactor commit)

Parallel execution per wave using subagent-driven-development.