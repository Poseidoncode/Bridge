import { describe, it, expect } from 'vitest';
import {
  parseShortcutString,
  normalizeShortcutString,
  isShortcutMatch
} from '../src/lib/shortcutManager';

describe('ShortcutManager', () => {
  describe('parseShortcutString', () => {
    it('should parse simple shortcut', () => {
      expect(parseShortcutString('Shift+S')).toEqual({ modifiers: ['shift'], key: 's' });
    });

    it('should parse multiple modifiers', () => {
      expect(parseShortcutString('Ctrl+Shift+A')).toEqual({ modifiers: ['ctrl', 'shift'], key: 'a' });
    });

    it('should handle lowercase input', () => {
      expect(parseShortcutString('alt+s')).toEqual({ modifiers: ['alt'], key: 's' });
    });

    it('should handle spaces in shortcut string', () => {
      expect(parseShortcutString('Cmd + K')).toEqual({ modifiers: ['cmd'], key: 'k' });
    });

    it('should handle empty string', () => {
      expect(parseShortcutString('')).toEqual({ modifiers: [], key: '' });
    });
  });

  describe('normalizeShortcutString', () => {
    it('should normalize modifiers', () => {
      expect(normalizeShortcutString('shift+s')).toBe('Shift+S');
      expect(normalizeShortcutString('ctrl+alt+del')).toBe('Ctrl+Alt+Del');
    });

    it('should handle alternative modifier names', () => {
      expect(normalizeShortcutString('command+k')).toBe('Cmd+K');
      expect(normalizeShortcutString('option+f')).toBe('Alt+F');
    });

    it('should return empty string if input is empty', () => {
      expect(normalizeShortcutString('')).toBe('');
    });
  });

  describe('isShortcutMatch', () => {
    it('should match exact shortcut', () => {
      const event = new KeyboardEvent('keydown', { key: 's', shiftKey: true });
      expect(isShortcutMatch(event, 'Shift+S')).toBe(true);
    });

    it('should not match if modifier is missing', () => {
      const event = new KeyboardEvent('keydown', { key: 's' });
      expect(isShortcutMatch(event, 'Shift+S')).toBe(false);
    });

    it('should not match if extra modifier is pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 's', shiftKey: true, ctrlKey: true });
      expect(isShortcutMatch(event, 'Shift+S')).toBe(false);
    });

    it('should not match if key is different', () => {
      const event = new KeyboardEvent('keydown', { key: 'a', shiftKey: true });
      expect(isShortcutMatch(event, 'Shift+S')).toBe(false);
    });

    it('should handle alternative modifier matching', () => {
      const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
      expect(isShortcutMatch(event, 'Command+K')).toBe(true);
      expect(isShortcutMatch(event, 'Cmd+K')).toBe(true);
    });
  });
});
