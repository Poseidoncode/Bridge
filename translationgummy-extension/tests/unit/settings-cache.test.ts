import { describe, it, expect, vi, beforeEach } from 'vitest';

interface SettingsCache {
  targetReadLang: string;
  targetWriteLang: string;
  initialized: boolean;
}

const settingsCache: SettingsCache = {
  targetReadLang: 'zh-Hant',
  targetWriteLang: 'en',
  initialized: false,
};

const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();

vi.mocked(chrome.storage.sync.get).mockImplementation(mockStorageGet);
vi.mocked(chrome.storage.sync.set).mockImplementation(mockStorageSet);

async function initSettingsCache(): Promise<void> {
  const settings = await chrome.storage.sync.get(['targetReadLang', 'targetWriteLang']);
  settingsCache.targetReadLang = settings.targetReadLang || 'zh-Hant';
  settingsCache.targetWriteLang = settings.targetWriteLang || 'en';
  settingsCache.initialized = true;
}

describe('Settings Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsCache.targetReadLang = 'zh-Hant';
    settingsCache.targetWriteLang = 'en';
    settingsCache.initialized = false;
  });

  it('should initialize with default values', async () => {
    mockStorageGet.mockResolvedValue({});
    
    await initSettingsCache();
    
    expect(settingsCache.targetReadLang).toBe('zh-Hant');
    expect(settingsCache.targetWriteLang).toBe('en');
    expect(settingsCache.initialized).toBe(true);
  });

  it('should use stored values when available', async () => {
    mockStorageGet.mockResolvedValue({
      targetReadLang: 'ja',
      targetWriteLang: 'ko'
    });
    
    await initSettingsCache();
    
    expect(settingsCache.targetReadLang).toBe('ja');
    expect(settingsCache.targetWriteLang).toBe('ko');
    expect(settingsCache.initialized).toBe(true);
  });

  it('should fallback to defaults for missing values', async () => {
    mockStorageGet.mockResolvedValue({
      targetReadLang: 'ja'
    });
    
    await initSettingsCache();
    
    expect(settingsCache.targetReadLang).toBe('ja');
    expect(settingsCache.targetWriteLang).toBe('en');
  });

  it('should update on storage change - readLang', async () => {
    const changes = {
      targetReadLang: {
        oldValue: 'zh-Hant',
        newValue: 'ja'
      }
    };
    
    const listener = (changes: Record<string, { oldValue: string; newValue: string }>) => {
      if (changes.targetReadLang?.newValue) {
        settingsCache.targetReadLang = changes.targetReadLang.newValue;
      }
    };
    
    listener(changes as any);
    
    expect(settingsCache.targetReadLang).toBe('ja');
  });

  it('should update on storage change - writeLang', async () => {
    const changes = {
      targetWriteLang: {
        oldValue: 'en',
        newValue: 'ko'
      }
    };
    
    const listener = (changes: Record<string, { oldValue: string; newValue: string }>) => {
      if (changes.targetWriteLang?.newValue) {
        settingsCache.targetWriteLang = changes.targetWriteLang.newValue;
      }
    };
    
    listener(changes as any);
    
    expect(settingsCache.targetWriteLang).toBe('ko');
  });
});