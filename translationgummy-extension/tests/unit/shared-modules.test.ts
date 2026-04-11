import { describe, it, expect } from 'vitest';
import { CSS_CLASSES, DATA_ATTRIBUTES, DEFAULTS, ELEMENT_IDS, STORAGE_KEYS } from '../../src/constants';
import { SUPPORTED_LANGUAGES, getLanguageByCode, searchLanguages } from '../../src/lib/languages';
import type {
  Language,
  NotificationOptions,
  ShortcutConfig,
  SiteExclusion,
  TranslationCacheEntry,
} from '../../src/lib/types';

describe('shared modules', () => {
  it('exposes shared types through imports', () => {
    const notification: NotificationOptions = {
      message: 'Saved',
      type: 'success',
      persistent: true,
      duration: 1000,
    };

    const language: Language = {
      code: 'en',
      name: 'English',
      flag: '🇬🇧',
    };

    const siteExclusion: SiteExclusion = {
      pattern: '*://example.com/*',
      addedAt: 123,
    };

    const cacheEntry: TranslationCacheEntry = {
      translation: 'hello',
      timestamp: 456,
    };

    const shortcutConfig: ShortcutConfig = {
      smartInput: 'Shift+S',
      translatePage: 'Alt+T',
      revertPage: 'Alt+R',
    };

    expect(notification.message).toBe('Saved');
    expect(language.code).toBe('en');
    expect(siteExclusion.pattern).toContain('example.com');
    expect(cacheEntry.translation).toBe('hello');
    expect(shortcutConfig.smartInput).toBe('Shift+S');
  });

  it('exports the expected constants', () => {
    expect(CSS_CLASSES.TRANSLATION_WRAPPER).toBe('translationbridge-translation-wrapper');
    expect(CSS_CLASSES.TRANSLATION_CONTENT).toBe('translationbridge-translation-content');
    expect(CSS_CLASSES.TRANSLATED).toBe('translationbridge-translated');
    expect(CSS_CLASSES.INLINE_TRANSLATED).toBe('translationbridge-inline-translated');
    expect(CSS_CLASSES.NOTIFICATION).toBe('translationbridge-notification');
    expect(ELEMENT_IDS.NOTIFICATION_CONTAINER).toBe('translationbridge-notification-container');
    expect(STORAGE_KEYS.TARGET_READ_LANG).toBe('targetReadLang');
    expect(STORAGE_KEYS.TARGET_WRITE_LANG).toBe('targetWriteLang');
    expect(STORAGE_KEYS.SITE_EXCLUSIONS).toBe('siteExclusions');
    expect(DATA_ATTRIBUTES.INJECTED).toBe('translationbridgeInjected');
    expect(DEFAULTS.TARGET_READ_LANG).toBe('zh-Hant');
    expect(DEFAULTS.TARGET_WRITE_LANG).toBe('en');
    expect(DEFAULTS.NOTIFICATION_DURATION).toBe(3200);
    expect(DEFAULTS.CACHE_MAX_SIZE).toBe(500);
    expect(DEFAULTS.CACHE_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('exposes the supported languages list', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(17);
    expect(SUPPORTED_LANGUAGES[0]).toEqual({ code: 'en', name: 'English', flag: '🇬🇧' });
    expect(SUPPORTED_LANGUAGES[1]).toEqual({ code: 'zh-Hant', name: '繁體中文', flag: '🇹🇼' });
  });

  it('searches languages by code and name', () => {
    expect(searchLanguages('zh')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'zh-Hant' }),
        expect.objectContaining({ code: 'zh-CN' }),
      ]),
    );
    expect(searchLanguages('日本')).toHaveLength(1);
    expect(searchLanguages('日本')[0]).toEqual({ code: 'ja', name: '日本語', flag: '🇯🇵' });
    expect(searchLanguages('esp')).toHaveLength(1);
    expect(searchLanguages('esp')[0]).toEqual({ code: 'es', name: 'Español', flag: '🇪🇸' });
  });

  it('finds languages by exact code', () => {
    expect(getLanguageByCode('ko')).toEqual({ code: 'ko', name: '한국어', flag: '🇰🇷' });
    expect(getLanguageByCode('missing')).toBeUndefined();
  });
});
