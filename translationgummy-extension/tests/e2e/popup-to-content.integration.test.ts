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

  getTabToggleState(tabId: number | null): boolean {
    if (tabId === null) return false;
    const value = this.tabToggleState[String(tabId)];
    return typeof value === 'boolean' ? value : false;
  }

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

  async handleTranslate(): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await chrome.tabs.sendMessage(tabs[0].id, { action: 'translatePage' });
    }
  }

  async handleRevert(): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await chrome.tabs.sendMessage(tabs[0].id, { action: 'revertPage' });
    }
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

  async initializeSettings(): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTabId = tabs[0]?.id ?? null;

    const syncResult = (await chrome.storage.sync.get([
      'targetWriteLang',
      'targetReadLang',
    ])) as { targetWriteLang?: string; targetReadLang?: string };
    this.targetWriteLang = syncResult.targetWriteLang ?? 'en';
    this.targetReadLang = syncResult.targetReadLang ?? 'zh-Hant';

    const localResult = (await chrome.storage.local.get([
      'translationToggleStateByTab',
    ])) as { translationToggleStateByTab?: TabToggleState };
    this.tabToggleState = localResult.translationToggleStateByTab ?? {};
    const savedToggleState = this.getTabToggleState(this.currentTabId);
    this.userIntendedState = savedToggleState;
    this.currentPageTranslated = savedToggleState;

    if (
      this.currentTabId !== null &&
      !(String(this.currentTabId) in this.tabToggleState)
    ) {
      await this.setTabToggleState(this.currentTabId, false);
    }

    this.settingsReady = true;
  }
}

function mockTab(id: number) {
  return [{ id, url: 'https://example.com', active: true }];
}

describe('Popup -> Content Script: message flow integration', () => {
  let popup: PopupController;
  const TAB_ID = 42;

  beforeEach(() => {
    vi.clearAllMocks();
    popup = new PopupController();

    vi.mocked(chrome.tabs.query).mockResolvedValue(mockTab(TAB_ID) as any);
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue(undefined);
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({});
    vi.mocked(chrome.storage.local.get).mockResolvedValue({});
    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
    vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined);
  });

  describe('handleTranslate', () => {
    it('queries the active tab in the current window', async () => {
      await popup.handleTranslate();

      expect(chrome.tabs.query).toHaveBeenCalledOnce();
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    it('sends translatePage message to the active tab', async () => {
      await popup.handleTranslate();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledOnce();
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'translatePage',
      });
    });

    it('sends the exact translatePage payload (no extra fields)', async () => {
      await popup.handleTranslate();

      const [, payload] = vi.mocked(chrome.tabs.sendMessage).mock.calls[0];
      expect(payload).toStrictEqual({ action: 'translatePage' });
    });

    it('does not send message when no active tab is available', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([]);

      await popup.handleTranslate();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('does not send message when tab has no id', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ url: 'https://example.com' } as any]);

      await popup.handleTranslate();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleRevert', () => {
    it('queries the active tab in the current window', async () => {
      await popup.handleRevert();

      expect(chrome.tabs.query).toHaveBeenCalledOnce();
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    it('sends revertPage message to the active tab', async () => {
      await popup.handleRevert();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledOnce();
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'revertPage',
      });
    });

    it('sends the exact revertPage payload (no extra fields)', async () => {
      await popup.handleRevert();

      const [, payload] = vi.mocked(chrome.tabs.sendMessage).mock.calls[0];
      expect(payload).toStrictEqual({ action: 'revertPage' });
    });

    it('does not send message when no active tab is available', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([]);

      await popup.handleRevert();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleToggleChange (toggle ON)', () => {
    it('sends translatePage when user turns translation on', async () => {
      await popup.handleToggleChange(true);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'translatePage',
      });
    });

    it('updates userIntendedState to true', async () => {
      await popup.handleToggleChange(true);
      expect(popup.userIntendedState).toBe(true);
    });

    it('updates currentPageTranslated to true', async () => {
      await popup.handleToggleChange(true);
      expect(popup.currentPageTranslated).toBe(true);
    });

    it('persists toggle state true to chrome.storage.local', async () => {
      await popup.handleToggleChange(true);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          translationToggleState: true,
          translationToggleStateByTab: expect.objectContaining({
            [String(TAB_ID)]: true,
          }),
        }),
      );
    });

    it('does NOT send revertPage when turning on', async () => {
      await popup.handleToggleChange(true);

      const messages = vi.mocked(chrome.tabs.sendMessage).mock.calls.map(
        ([, msg]) => (msg as any).action,
      );
      expect(messages).not.toContain('revertPage');
    });
  });

  describe('handleToggleChange (toggle OFF)', () => {
    beforeEach(() => {
      popup.currentPageTranslated = true;
      popup.userIntendedState = true;
    });

    it('sends revertPage when user turns translation off', async () => {
      await popup.handleToggleChange(false);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(TAB_ID, {
        action: 'revertPage',
      });
    });

    it('updates userIntendedState to false', async () => {
      await popup.handleToggleChange(false);
      expect(popup.userIntendedState).toBe(false);
    });

    it('updates currentPageTranslated to false', async () => {
      await popup.handleToggleChange(false);
      expect(popup.currentPageTranslated).toBe(false);
    });

    it('persists toggle state false to chrome.storage.local', async () => {
      await popup.handleToggleChange(false);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          translationToggleState: false,
          translationToggleStateByTab: expect.objectContaining({
            [String(TAB_ID)]: false,
          }),
        }),
      );
    });

    it('does NOT send translatePage when turning off', async () => {
      await popup.handleToggleChange(false);

      const messages = vi.mocked(chrome.tabs.sendMessage).mock.calls.map(
        ([, msg]) => (msg as any).action,
      );
      expect(messages).not.toContain('translatePage');
    });
  });

  describe('initializeSettings', () => {
    it('loads targetReadLang and targetWriteLang from sync storage', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({
        targetReadLang: 'ja',
        targetWriteLang: 'ko',
      });

      await popup.initializeSettings();

      expect(popup.targetReadLang).toBe('ja');
      expect(popup.targetWriteLang).toBe('ko');
    });

    it('falls back to defaults when sync storage is empty', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({});

      await popup.initializeSettings();

      expect(popup.targetReadLang).toBe('zh-Hant');
      expect(popup.targetWriteLang).toBe('en');
    });

    it('loads per-tab toggle state from local storage', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        translationToggleStateByTab: { [String(TAB_ID)]: true },
      });

      await popup.initializeSettings();

      expect(popup.tabToggleState).toEqual({ [String(TAB_ID)]: true });
      expect(popup.userIntendedState).toBe(true);
      expect(popup.currentPageTranslated).toBe(true);
    });

    it('initialises toggle state for new tab that has no saved state', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        translationToggleStateByTab: {},
      });

      await popup.initializeSettings();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          translationToggleStateByTab: { [String(TAB_ID)]: false },
          translationToggleState: false,
        }),
      );
    });

    it('sets settingsReady to true after loading', async () => {
      await popup.initializeSettings();
      expect(popup.settingsReady).toBe(true);
    });

    it('stores currentTabId from the active tab', async () => {
      await popup.initializeSettings();
      expect(popup.currentTabId).toBe(TAB_ID);
    });
  });

  describe('translate then revert sequence', () => {
    it('sends translatePage first then revertPage on two separate calls', async () => {
      await popup.handleToggleChange(true);
      await popup.handleToggleChange(false);

      const calls = vi.mocked(chrome.tabs.sendMessage).mock.calls;
      expect(calls).toHaveLength(2);
      expect((calls[0][1] as any).action).toBe('translatePage');
      expect((calls[1][1] as any).action).toBe('revertPage');
    });

    it('always sends to the same tab id', async () => {
      await popup.handleTranslate();
      await popup.handleRevert();

      const tabIds = vi.mocked(chrome.tabs.sendMessage).mock.calls.map(
        ([tabId]) => tabId,
      );
      expect(tabIds).toEqual([TAB_ID, TAB_ID]);
    });
  });

  describe('setTabToggleState', () => {
    it('merges new state into existing tabToggleState map', async () => {
      popup.tabToggleState = { '10': true };

      await popup.setTabToggleState(20, false);

      expect(popup.tabToggleState).toEqual({ '10': true, '20': false });
    });

    it('writes merged map to chrome.storage.local', async () => {
      popup.tabToggleState = { '10': true };
      await popup.setTabToggleState(20, false);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        translationToggleStateByTab: { '10': true, '20': false },
        translationToggleState: false,
      });
    });

    it('does nothing when tabId is null', async () => {
      await popup.setTabToggleState(null, true);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });
});
