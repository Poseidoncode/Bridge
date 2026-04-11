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
