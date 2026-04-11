import { DEFAULTS } from '../constants';
import type { TranslationCacheEntry } from './types';

export class TranslationCache {
  private cache = new Map<string, TranslationCacheEntry>();

  public get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > DEFAULTS.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.translation;
  }

  public set(key: string, translation: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= DEFAULTS.CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      translation,
      timestamp: Date.now()
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const translationCache = new TranslationCache();

export function generateCacheKey(sourceLang: string, targetLang: string, text: string): string {
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  return `${sourceLang}|${targetLang}|${normalizedText}`;
}
