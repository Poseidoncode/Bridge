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
} as const;

export const ELEMENT_IDS = {
  NOTIFICATION_CONTAINER: 'translationbridge-notification-container',
  LOADING: 'translationbridge-loading',
  SMART_INPUT_STATUS: 'translationbridge-smart-input-status',
  SMART_INPUT_HINT: 'translationbridge-smart-input-hint',
} as const;

export const STORAGE_KEYS = {
  TARGET_READ_LANG: 'targetReadLang',
  TARGET_WRITE_LANG: 'targetWriteLang',
  SITE_EXCLUSIONS: 'siteExclusions',
  SHORTCUT_CONFIG: 'shortcutConfig',
  TRANSLATION_TOGGLE_BY_TAB: 'translationToggleStateByTab',
  TRANSLATION_TOGGLE: 'translationToggleState',
} as const;

export const DATA_ATTRIBUTES = {
  INJECTED: 'translationbridgeInjected',
  ORIGINAL: 'translationbridgeOriginal',
  ORIGINAL_INLINE: 'translationbridgeOriginalInline',
} as const;

export const DEFAULTS = {
  TARGET_READ_LANG: 'zh-Hant',
  TARGET_WRITE_LANG: 'en',
  NOTIFICATION_DURATION: 3200,
  CACHE_MAX_SIZE: 500,
  CACHE_TTL_MS: 30 * 60 * 1000,
} as const;
