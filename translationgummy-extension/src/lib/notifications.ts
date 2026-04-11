import { CSS_CLASSES, DEFAULTS, ELEMENT_IDS } from '../constants';
import type { NotificationOptions } from './types';

const ANIMATION_STYLE_ID = 'translationbridge-notification-styles';

const TYPE_CLASS_MAP: Record<NotificationOptions['type'], string> = {
  info: CSS_CLASSES.NOTIFICATION_INFO,
  success: CSS_CLASSES.NOTIFICATION_SUCCESS,
  error: CSS_CLASSES.NOTIFICATION_ERROR,
  warning: CSS_CLASSES.NOTIFICATION_WARNING,
};

const TYPE_STYLES: Record<NotificationOptions['type'], { bg: string; border: string }> = {
  info: { bg: 'rgba(30, 64, 175, 0.9)', border: '#2563eb' },
  success: { bg: 'rgba(21, 128, 61, 0.9)', border: '#15803d' },
  error: { bg: 'rgba(185, 28, 28, 0.9)', border: '#b91c1c' },
  warning: { bg: 'rgba(180, 83, 9, 0.9)', border: '#d97706' },
};

export class NotificationManager {
  private container: HTMLElement | null = null;
  private activeNotifications: Map<string, HTMLElement> = new Map();
  private timers: Map<string, number> = new Map();

  constructor() {
    injectAnimationStyles();
    this.ensureContainer();
  }

  private ensureContainer(): HTMLElement {
    if (!this.container || !this.container.isConnected) {
      this.container = document.createElement('div');
      this.container.id = ELEMENT_IDS.NOTIFICATION_CONTAINER;
      this.container.style.cssText = [
        'position: fixed',
        'top: 20px',
        'right: 20px',
        'z-index: 10000',
        'display: flex',
        'flex-direction: column',
        'gap: 8px',
        'pointer-events: auto',
      ].join('; ');
      document.body.appendChild(this.container);
    }

    return this.container;
  }

  show(options: NotificationOptions): string {
    const id = options.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = options.duration ?? DEFAULTS.NOTIFICATION_DURATION;

    if (this.activeNotifications.has(id)) {
      this.dismiss(id);
    }

    const notification = document.createElement('div');
    notification.className = `${CSS_CLASSES.NOTIFICATION} ${TYPE_CLASS_MAP[options.type]}`;
    notification.dataset.notificationId = id;
    notification.setAttribute('role', options.type === 'error' ? 'alert' : 'status');
    notification.style.cssText = [
      'display: flex',
      'align-items: center',
      'padding: 12px 16px',
      'border-radius: 8px',
      'min-width: 280px',
      'max-width: 400px',
      'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)',
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      'font-size: 14px',
      'animation: slideIn 0.3s ease-out',
      'background: var(--notification-bg)',
      'color: white',
      'border-left: 4px solid var(--notification-border)',
    ].join('; ');

    const style = TYPE_STYLES[options.type];
    notification.style.setProperty('--notification-bg', style.bg);
    notification.style.setProperty('--notification-border', style.border);

    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; margin-right: 12px;';
    content.textContent = options.message;
    notification.appendChild(content);

    if (!options.persistent) {
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = '×';
      closeButton.setAttribute('aria-label', 'Dismiss notification');
      closeButton.style.cssText = [
        'background: transparent',
        'border: none',
        'color: inherit',
        'font-size: 20px',
        'cursor: pointer',
        'padding: 0',
        'line-height: 1',
        'width: 24px',
        'height: 24px',
        'display: flex',
        'align-items: center',
        'justify-content: center',
      ].join('; ');
      closeButton.onclick = () => this.dismiss(id);
      notification.appendChild(closeButton);
    }

    this.ensureContainer().appendChild(notification);
    this.activeNotifications.set(id, notification);

    if (!options.persistent) {
      const timer = window.setTimeout(() => this.dismiss(id), duration);
      this.timers.set(id, timer);
    }

    return id;
  }

  dismiss(id: string): void {
    const notification = this.activeNotifications.get(id);
    if (!notification) {
      return;
    }

    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.activeNotifications.delete(id);
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    window.setTimeout(() => notification.remove(), 300);
  }

  clearAll(): void {
    for (const id of [...this.activeNotifications.keys()]) {
      this.dismiss(id);
    }
  }

  destroy(): void {
    this.clearAll();
    this.container?.remove();
    this.container = null;
  }

  private static instance: NotificationManager | null = null;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }

    return NotificationManager.instance;
  }

  static resetInstance(): void {
    NotificationManager.instance?.destroy();
    NotificationManager.instance = null;
  }
}

function injectAnimationStyles(): void {
  if (document.getElementById(ANIMATION_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = ANIMATION_STYLE_ID;
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
