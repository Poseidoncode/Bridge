import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSS_CLASSES, DEFAULTS, ELEMENT_IDS } from '../../src/constants';
import { NotificationManager } from '../../src/lib/notifications';

describe('NotificationManager', () => {
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

  it('show() creates a notification DOM element', () => {
    const manager = new NotificationManager();

    const id = manager.show({ message: 'Hello', type: 'info' });

    const container = document.getElementById(ELEMENT_IDS.NOTIFICATION_CONTAINER);
    const notification = container?.querySelector(`[data-notification-id="${id}"]`);

    expect(container).toBeTruthy();
    expect(notification).toBeInstanceOf(HTMLElement);
    expect(notification?.getAttribute('role')).toBe('status');
    expect(notification?.textContent).toContain('Hello');
  });

  it('dismiss() removes a notification', () => {
    const manager = new NotificationManager();
    const id = manager.show({ message: 'Bye', type: 'success', persistent: true });

    manager.dismiss(id);
    vi.advanceTimersByTime(300);

    expect(document.querySelector(`[data-notification-id="${id}"]`)).toBeNull();
  });

  it('clearAll() removes all notifications', () => {
    const manager = new NotificationManager();
    const first = manager.show({ message: 'One', type: 'info', persistent: true });
    const second = manager.show({ message: 'Two', type: 'warning', persistent: true });

    manager.clearAll();
    vi.advanceTimersByTime(300);

    expect(document.querySelector(`[data-notification-id="${first}"]`)).toBeNull();
    expect(document.querySelector(`[data-notification-id="${second}"]`)).toBeNull();
  });

  it('auto-dismisses non-persistent notifications', () => {
    const manager = new NotificationManager();
    const id = manager.show({ message: 'Timed', type: 'info' });

    vi.advanceTimersByTime(DEFAULTS.NOTIFICATION_DURATION + 300);

    expect(document.querySelector(`[data-notification-id="${id}"]`)).toBeNull();
  });

  it('does not auto-dismiss persistent notifications', () => {
    const manager = new NotificationManager();
    const id = manager.show({ message: 'Keep', type: 'warning', persistent: true });

    vi.advanceTimersByTime(DEFAULTS.NOTIFICATION_DURATION + 5000);

    expect(document.querySelector(`[data-notification-id="${id}"]`)).not.toBeNull();
  });

  it('applies type-specific styling', () => {
    const manager = new NotificationManager();

    const infoId = manager.show({ message: 'Info', type: 'info', persistent: true });
    const successId = manager.show({ message: 'Success', type: 'success', persistent: true });
    const errorId = manager.show({ message: 'Error', type: 'error', persistent: true });
    const warningId = manager.show({ message: 'Warning', type: 'warning', persistent: true });

    const info = document.querySelector(`[data-notification-id="${infoId}"]`) as HTMLElement;
    const success = document.querySelector(`[data-notification-id="${successId}"]`) as HTMLElement;
    const error = document.querySelector(`[data-notification-id="${errorId}"]`) as HTMLElement;
    const warning = document.querySelector(`[data-notification-id="${warningId}"]`) as HTMLElement;

    expect(info.className).toContain(CSS_CLASSES.NOTIFICATION_INFO);
    expect(success.className).toContain(CSS_CLASSES.NOTIFICATION_SUCCESS);
    expect(error.className).toContain(CSS_CLASSES.NOTIFICATION_ERROR);
    expect(warning.className).toContain(CSS_CLASSES.NOTIFICATION_WARNING);
    expect(error?.getAttribute('role')).toBe('alert');
  });

  it('getInstance() returns a singleton', () => {
    const first = NotificationManager.getInstance();
    const second = NotificationManager.getInstance();

    expect(first).toBe(second);
    expect(document.getElementById(ELEMENT_IDS.NOTIFICATION_CONTAINER)).toBeTruthy();
  });
});
