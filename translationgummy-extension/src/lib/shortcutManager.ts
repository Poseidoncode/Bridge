import { STORAGE_KEYS } from '../constants';
import type { ShortcutConfig } from './types';

export interface ParsedShortcut {
  modifiers: string[];
  key: string;
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  smartInput: 'Shift+S',
  translatePage: 'Alt+T',
  revertPage: 'Alt+R'
};

export function parseShortcutString(str: string): ParsedShortcut {
  if (!str) return { modifiers: [], key: '' };
  
  const parts = str.toLowerCase().split('+').map(p => p.trim());
  const key = parts.pop() || '';
  const modifiers = parts;
  
  return { modifiers, key };
}

export function normalizeShortcutString(str: string): string {
  if (!str) return '';
  
  const { modifiers, key } = parseShortcutString(str);
  
  const modifierMap: Record<string, string> = {
    ctrl: 'Ctrl',
    control: 'Ctrl',
    cmd: 'Cmd',
    command: 'Cmd',
    meta: 'Cmd',
    alt: 'Alt',
    option: 'Alt',
    shift: 'Shift'
  };

  const normalizedModifiers = modifiers.map(m => modifierMap[m] || m.charAt(0).toUpperCase() + m.slice(1));
  const normalizedKey = key.length === 1 ? key.toUpperCase() : (key.charAt(0).toUpperCase() + key.slice(1));
  
  if (normalizedModifiers.length > 0) {
    return [...normalizedModifiers, normalizedKey].join('+');
  }
  return normalizedKey;
}

export function isShortcutMatch(event: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut || !event) return false;
  
  const { modifiers, key } = parseShortcutString(shortcut);
  const eventKey = event.key.toLowerCase();
  
  if (eventKey !== key) return false;
  
  const hasCtrl = modifiers.includes('ctrl') || modifiers.includes('control');
  const hasAlt = modifiers.includes('alt') || modifiers.includes('option');
  const hasShift = modifiers.includes('shift');
  const hasMeta = modifiers.includes('meta') || modifiers.includes('cmd') || modifiers.includes('command');
  
  if (['control', 'alt', 'shift', 'meta'].includes(eventKey)) return false;

  if (hasCtrl !== event.ctrlKey) return false;
  if (hasAlt !== event.altKey) return false;
  if (hasShift !== event.shiftKey) return false;
  if (hasMeta !== event.metaKey) return false;
  
  return true;
}

export async function getSmartInputShortcut(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.SHORTCUT_CONFIG], (result) => {
      const config = result[STORAGE_KEYS.SHORTCUT_CONFIG] as ShortcutConfig | undefined;
      resolve(config?.smartInput || DEFAULT_SHORTCUTS.smartInput);
    });
  });
}

export async function setSmartInputShortcut(shortcut: string): Promise<void> {
  const normalized = normalizeShortcutString(shortcut);
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.SHORTCUT_CONFIG], (result) => {
      const config = (result[STORAGE_KEYS.SHORTCUT_CONFIG] || { ...DEFAULT_SHORTCUTS }) as ShortcutConfig;
      config.smartInput = normalized;
      chrome.storage.local.set({ [STORAGE_KEYS.SHORTCUT_CONFIG]: config }, resolve);
    });
  });
}
