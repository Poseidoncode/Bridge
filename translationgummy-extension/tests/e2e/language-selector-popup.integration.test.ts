// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface TabToggleState {
  [tabId: string]: boolean;
}

class PopupController {
  targetWriteLang = 'en';
  targetReadLang = 'zh-Hant';
  currentPageTranslated = false;
  userIntendedState = false;
  settingsReady = false;
  currentTabId: number | null = null;
  tabToggleState: TabToggleState = {};

  async setTabToggleState(tabId: number | null, value: boolean): Promise<void> {
    if (tabId === null) return;
    const key = String(tabId);
    const nextState: TabToggleState = { ...this.tabToggleState, [key]: value };
    this.tabToggleState = nextState;
    await chrome.storage.local.set({
      translationToggleStateByTab: nextState,
      translationToggleState: value,
    });
  }

  async handleLanguageChange(): Promise<void> {
    if (this.currentPageTranslated && this.userIntendedState) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateExistingTranslations',
        });
      }
    }
  }

  async saveLanguageSettings(): Promise<void> {
    await chrome.storage.sync.set({
      targetReadLang: this.targetReadLang,
      targetWriteLang: this.targetWriteLang,
    });
  }

  async handleToggleChange(newState: boolean): Promise<void> {
    this.userIntendedState = newState;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = tabs[0]?.id ?? null;

    if (activeTabId !== null) {
      this.currentTabId = activeTabId;
      if (newState) {
        await chrome.tabs.sendMessage(activeTabId, { action: 'translatePage' });
      } else {
        await chrome.tabs.sendMessage(activeTabId, { action: 'revertPage' });
      }
      this.currentPageTranslated = newState;
      await this.setTabToggleState(activeTabId, newState);
    }
  }
}

function mockTab(id: number) {
  return [{ id, url: 'https://example.com', active: true }];
}

describe('LanguageSelector + Popup integration', () => {
  let popup: PopupController;
  const TAB_ID = 7;

  beforeEach(() => {
    vi.clearAllMocks();
    popup = new PopupController();

    vi.mocked(chrome.tabs.query).mockResolvedValue(mockTab(TAB_ID) as any);
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue(undefined);
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({});
    vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined);
    vi.mocked(chrome.storage.local.get).mockResolvedValue({});
    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
  });

  describe('language change while translation is ON', () => {
    beforeEach(() => {
      popup.currentPageTranslated = true;
      popup.userIntendedState = true;
    });

    it('sends updateExistingTranslations to the active tab', async () => {
      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledOnce();
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'updateExistingTranslations',
      });
    });

    it('sends the exact updateExistingTranslations payload (no extra fields)', async () => {
      await popup.handleLanguageChange();

      const [, payload] = vi.mocked(chrome.tabs.sendMessage).mock.calls[0];
      expect(payload).toStrictEqual({ action: 'updateExistingTranslations' });
    });

    it('queries the active tab before sending message', async () => {
      await popup.handleLanguageChange();

      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    it('sends updateExistingTranslations when reading language changes to ja', async () => {
      popup.targetReadLang = 'ja';

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'updateExistingTranslations',
      });
    });

    it('sends updateExistingTranslations when reading language changes to ko', async () => {
      popup.targetReadLang = 'ko';

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'updateExistingTranslations',
      });
    });

    it('sends updateExistingTranslations when writing language changes', async () => {
      popup.targetWriteLang = 'fr';

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'updateExistingTranslations',
      });
    });

    it('does not send translatePage or revertPage on language change', async () => {
      await popup.handleLanguageChange();

      const actions = vi.mocked(chrome.tabs.sendMessage).mock.calls.map(
        ([, msg]) => (msg as any).action,
      );
      expect(actions).not.toContain('translatePage');
      expect(actions).not.toContain('revertPage');
    });

    it('does not send message when no active tab is available', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([]);

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('language change while translation is OFF', () => {
    beforeEach(() => {
      popup.currentPageTranslated = false;
      popup.userIntendedState = false;
    });

    it('does not send any message to content script', async () => {
      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('does not query tabs when translation is OFF', async () => {
      await popup.handleLanguageChange();

      expect(chrome.tabs.query).not.toHaveBeenCalled();
    });

    it('does not send updateExistingTranslations when reading language changes', async () => {
      popup.targetReadLang = 'ja';

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('does not send updateExistingTranslations when writing language changes', async () => {
      popup.targetWriteLang = 'de';

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('language change when currentPageTranslated is ON but userIntendedState is OFF', () => {
    it('does not send updateExistingTranslations (both flags must be true)', async () => {
      popup.currentPageTranslated = true;
      popup.userIntendedState = false;

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('language change when userIntendedState is ON but currentPageTranslated is OFF', () => {
    it('does not send updateExistingTranslations (both flags must be true)', async () => {
      popup.currentPageTranslated = false;
      popup.userIntendedState = true;

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('toggle ON then language change sequence', () => {
    it('enables translation then updates translations on language change', async () => {
      await popup.handleToggleChange(true);

      vi.mocked(chrome.tabs.sendMessage).mockClear();

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledOnce();
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'updateExistingTranslations',
      });
    });

    it('sends translatePage first, then updateExistingTranslations on language change', async () => {
      await popup.handleToggleChange(true);
      await popup.handleLanguageChange();

      const actions = vi.mocked(chrome.tabs.sendMessage).mock.calls.map(
        ([, msg]) => (msg as any).action,
      );
      expect(actions[0]).toBe('translatePage');
      expect(actions[1]).toBe('updateExistingTranslations');
    });
  });

  describe('toggle OFF then language change sequence', () => {
    it('does not send updateExistingTranslations after toggling off', async () => {
      popup.currentPageTranslated = true;
      popup.userIntendedState = true;

      await popup.handleToggleChange(false);

      vi.mocked(chrome.tabs.sendMessage).mockClear();

      await popup.handleLanguageChange();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('saveLanguageSettings', () => {
    it('persists targetReadLang and targetWriteLang to sync storage', async () => {
      popup.targetReadLang = 'ja';
      popup.targetWriteLang = 'ko';

      await popup.saveLanguageSettings();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        targetReadLang: 'ja',
        targetWriteLang: 'ko',
      });
    });

    it('persists default language values when unchanged', async () => {
      await popup.saveLanguageSettings();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        targetReadLang: 'zh-Hant',
        targetWriteLang: 'en',
      });
    });

    it('persists updated readLang independently', async () => {
      popup.targetReadLang = 'fr';

      await popup.saveLanguageSettings();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ targetReadLang: 'fr' }),
      );
    });

    it('persists updated writeLang independently', async () => {
      popup.targetWriteLang = 'de';

      await popup.saveLanguageSettings();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ targetWriteLang: 'de' }),
      );
    });
  });
});
