import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationManager } from '../../src/lib/notifications';
import { CSS_CLASSES, DEFAULTS, ELEMENT_IDS } from '../../src/constants';

function getContainer(): HTMLElement | null {
  return document.getElementById(ELEMENT_IDS.NOTIFICATION_CONTAINER);
}

describe('NotificationManager - content.ts integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    document.head.querySelector('#translationbridge-notification-styles')?.remove();
    NotificationManager.resetInstance();
  });

  afterEach(() => {
    NotificationManager.resetInstance();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('NotificationManager import and singleton', () => {
    it('NotificationManager can be imported and getInstance() works', () => {
      const manager = NotificationManager.getInstance();
      expect(manager).toBeInstanceOf(NotificationManager);
    });

    it('getInstance() returns the same instance on repeated calls', () => {
      const a = NotificationManager.getInstance();
      const b = NotificationManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates container on first getInstance()', () => {
      NotificationManager.getInstance();
      expect(getContainer()).toBeTruthy();
    });
  });

  describe('showSmartInputStatus - delegates to NotificationManager', () => {
    it('shows an info notification with the given message', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({ message: 'Translating your input…', type: 'info' });

      const notif = getContainer()?.querySelector(`[data-notification-id="${id}"]`);

      expect(notif).toBeInstanceOf(HTMLElement);
      expect(notif?.textContent).toContain('Translating your input…');
      expect(notif?.className).toContain(CSS_CLASSES.NOTIFICATION_INFO);
    });

    it('shows a success notification', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({ message: 'Translation complete', type: 'success' });

      const notif = getContainer()?.querySelector(`[data-notification-id="${id}"]`);
      expect(notif?.className).toContain(CSS_CLASSES.NOTIFICATION_SUCCESS);
    });

    it('shows an error notification with role="alert"', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({ message: 'Translation failed', type: 'error' });

      const notif = getContainer()?.querySelector(`[data-notification-id="${id}"]`);
      expect(notif?.className).toContain(CSS_CLASSES.NOTIFICATION_ERROR);
      expect(notif?.getAttribute('role')).toBe('alert');
    });

    it('auto-dismisses non-persistent notifications after default duration', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({ message: 'Fades away', type: 'info' });

      vi.advanceTimersByTime(DEFAULTS.NOTIFICATION_DURATION + 400);

      expect(getContainer()?.querySelector(`[data-notification-id="${id}"]`)).toBeNull();
    });

    it('persistent notification is NOT auto-dismissed', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({ message: 'Stay', type: 'info', persistent: true });

      vi.advanceTimersByTime(DEFAULTS.NOTIFICATION_DURATION + 5000);

      expect(getContainer()?.querySelector(`[data-notification-id="${id}"]`)).not.toBeNull();
    });

    it('dismiss() removes a notification after animation', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({ message: 'Bye', type: 'info', persistent: true });

      manager.dismiss(id);
      vi.advanceTimersByTime(400);

      expect(getContainer()?.querySelector(`[data-notification-id="${id}"]`)).toBeNull();
    });

    it('re-showing with same id replaces old notification after animation', () => {
      const manager = NotificationManager.getInstance();
      const id = 'smart-input-loading';
      manager.show({ id, message: 'First message', type: 'info', persistent: true });
      manager.show({ id, message: 'Updated message', type: 'info', persistent: true });

      vi.advanceTimersByTime(400);

      const notifications = getContainer()?.querySelectorAll(`[data-notification-id="${id}"]`);
      expect(notifications?.length).toBe(1);
      expect(notifications?.[0]?.textContent).toContain('Updated message');
    });
  });

  describe('translatePage loading indicator via NotificationManager', () => {
    it('persistent notification represents "Translating…" state and does not auto-dismiss', () => {
      const manager = NotificationManager.getInstance();
      const loadingId = manager.show({
        message: 'Translating...',
        type: 'info',
        persistent: true,
      });

      const notif = getContainer()?.querySelector(`[data-notification-id="${loadingId}"]`);
      expect(notif).toBeInstanceOf(HTMLElement);
      expect(notif?.textContent).toContain('Translating...');

      vi.advanceTimersByTime(DEFAULTS.NOTIFICATION_DURATION + 1000);
      expect(getContainer()?.querySelector(`[data-notification-id="${loadingId}"]`)).not.toBeNull();
    });

    it('dismiss() removes the loading notification on completion', () => {
      const manager = NotificationManager.getInstance();
      const loadingId = manager.show({
        message: 'Translating...',
        type: 'info',
        persistent: true,
      });

      manager.dismiss(loadingId);
      vi.advanceTimersByTime(400);

      expect(getContainer()?.querySelector(`[data-notification-id="${loadingId}"]`)).toBeNull();
    });

    it('re-showing with same id updates to "Downloading translation model…"', () => {
      const manager = NotificationManager.getInstance();
      const loadingId = 'translating-loading';

      manager.show({ id: loadingId, message: 'Translating...', type: 'info', persistent: true });
      manager.show({ id: loadingId, message: 'Downloading translation model...', type: 'info', persistent: true });

      vi.advanceTimersByTime(400);

      const notif = getContainer()?.querySelector(`[data-notification-id="${loadingId}"]`);
      expect(notif?.textContent).toContain('Downloading translation model...');

      vi.advanceTimersByTime(DEFAULTS.NOTIFICATION_DURATION + 1000);
      expect(getContainer()?.querySelector(`[data-notification-id="${loadingId}"]`)).not.toBeNull();
    });
  });

  describe('translatePage error notification via NotificationManager', () => {
    it('shows error notification with correct message', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({
        message: 'Translation failed, please try again later',
        type: 'error',
        persistent: false,
        duration: 3000,
      });

      const notif = getContainer()?.querySelector(`[data-notification-id="${id}"]`);
      expect(notif).toBeInstanceOf(HTMLElement);
      expect(notif?.textContent).toContain('Translation failed, please try again later');
      expect(notif?.className).toContain(CSS_CLASSES.NOTIFICATION_ERROR);
    });

    it('error notification auto-dismisses after 3000ms', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({
        message: 'Translation failed, please try again later',
        type: 'error',
        persistent: false,
        duration: 3000,
      });

      expect(getContainer()?.querySelector(`[data-notification-id="${id}"]`)).not.toBeNull();

      vi.advanceTimersByTime(3000 + 400);
      expect(getContainer()?.querySelector(`[data-notification-id="${id}"]`)).toBeNull();
    });

    it('error notification has role="alert" for accessibility', () => {
      const manager = NotificationManager.getInstance();
      const id = manager.show({
        message: 'Translation failed, please try again later',
        type: 'error',
        persistent: false,
        duration: 3000,
      });

      const notif = getContainer()?.querySelector(`[data-notification-id="${id}"]`);
      expect(notif?.getAttribute('role')).toBe('alert');
    });

    it('does NOT create a stray errorDiv with old inline #dc3545 style', () => {
      const manager = NotificationManager.getInstance();
      manager.show({
        message: 'Translation failed, please try again later',
        type: 'error',
        persistent: false,
        duration: 3000,
      });

      const strayErrorDivs = Array.from(document.body.children).filter(el => {
        const style = (el as HTMLElement).style?.background;
        return style && style.includes('#dc3545');
      });
      expect(strayErrorDivs.length).toBe(0);
    });
  });

  describe('showNotification message handler', () => {
    it('NotificationManager.show() works with message-like payload', () => {
      const manager = NotificationManager.getInstance();

      const message = {
        action: 'showNotification',
        message: 'Auto-translated page',
        type: 'success' as const,
        persistent: false,
        duration: DEFAULTS.NOTIFICATION_DURATION,
      };

      const id = manager.show({
        message: message.message,
        type: message.type,
        persistent: message.persistent,
        duration: message.duration,
      });

      const notif = getContainer()?.querySelector(`[data-notification-id="${id}"]`);
      expect(notif).toBeInstanceOf(HTMLElement);
      expect(notif?.textContent).toContain('Auto-translated page');
      expect(notif?.className).toContain(CSS_CLASSES.NOTIFICATION_SUCCESS);
    });

    it('defaults to type "info" when type is not provided in message', () => {
      const manager = NotificationManager.getInstance();

      const message = { action: 'showNotification', message: 'Some info' };

      const id = manager.show({
        message: message.message,
        type: (message as any).type || 'info',
        persistent: false,
        duration: DEFAULTS.NOTIFICATION_DURATION,
      });

      const notif = getContainer()?.querySelector(`[data-notification-id="${id}"]`);
      expect(notif?.className).toContain(CSS_CLASSES.NOTIFICATION_INFO);
    });

    it('persistent flag from message prevents auto-dismiss', () => {
      const manager = NotificationManager.getInstance();

      const message = {
        action: 'showNotification',
        message: 'Persistent notice',
        type: 'warning' as const,
        persistent: true,
      };

      const id = manager.show({
        message: message.message,
        type: message.type,
        persistent: message.persistent,
        duration: DEFAULTS.NOTIFICATION_DURATION,
      });

      vi.advanceTimersByTime(DEFAULTS.NOTIFICATION_DURATION + 5000);

      expect(getContainer()?.querySelector(`[data-notification-id="${id}"]`)).not.toBeNull();
    });
  });

  describe('Old notification DOM patterns are not present after refactor', () => {
    it('old #translationbridge-loading element is NOT created by NotificationManager', () => {
      const manager = NotificationManager.getInstance();
      manager.show({ message: 'Translating...', type: 'info', persistent: true });

      expect(document.getElementById('translationbridge-loading')).toBeNull();
    });

    it('old #translationbridge-smart-input-status is NOT used by NotificationManager', () => {
      const manager = NotificationManager.getInstance();
      manager.show({ message: 'Smart input active', type: 'info' });

      expect(document.getElementById('translationbridge-smart-input-status')).toBeNull();
    });

    it('notification container uses the correct ELEMENT_IDS.NOTIFICATION_CONTAINER id', () => {
      NotificationManager.getInstance();
      const container = document.getElementById(ELEMENT_IDS.NOTIFICATION_CONTAINER);
      expect(container).toBeTruthy();
      expect(container?.id).toBe(ELEMENT_IDS.NOTIFICATION_CONTAINER);
    });
  });
});
