import { STORAGE_KEYS } from '../constants';
import type { SiteExclusion } from './types';

export class SiteExclusionManager {
  private exclusions: SiteExclusion[] = [];
  private initialized = false;
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
    const normalized = this.normalizePattern(pattern);

    if (this.exclusions.some((exclusion) => exclusion.pattern === normalized)) {
      throw new Error('Pattern already exists in exclusions');
    }

    this.exclusions.push({ pattern: normalized, addedAt: Date.now() });
    await this.saveToStorage();
  }

  async remove(pattern: string): Promise<void> {
    await this.initialize();
    const normalized = this.normalizePattern(pattern);
    const index = this.exclusions.findIndex((exclusion) => exclusion.pattern === normalized);

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
        if (this.matchesPattern(hostname, exclusion.pattern)) return true;
        if (this.matchesPattern(url, exclusion.pattern)) return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private normalizePattern(pattern: string): string {
    return pattern.trim().toLowerCase();
  }

  private matchesPattern(value: string, pattern: string): boolean {
    const lowerValue = value.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    if (lowerPattern.startsWith('*.')) {
      const domain = lowerPattern.slice(2);
      return lowerValue === domain || lowerValue.endsWith('.' + domain);
    }

    if (lowerValue === lowerPattern) return true;
    if (lowerValue.endsWith('.' + lowerPattern)) return true;
    if (lowerPattern.includes('/')) {
      return lowerValue.includes(lowerPattern);
    }

    return false;
  }

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
