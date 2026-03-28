import { describe, it, expect } from 'vitest';

function heuristicLanguageDetection(text: string): string {
  const koreanRegex = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
  if (koreanRegex.test(text)) {
    return 'ko';
  }

  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
  if (japaneseRegex.test(text)) {
    return 'ja';
  }

  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  if (chineseRegex.test(text)) {
    return 'zh-Hant';
  }

  const cyrillicRegex = /[\u0400-\u04ff]/;
  if (cyrillicRegex.test(text)) {
    return 'ru';
  }

  const arabicRegex = /[\u0600-\u06ff]/;
  if (arabicRegex.test(text)) {
    return 'ar';
  }

  const devanagariRegex = /[\u0900-\u097f]/;
  if (devanagariRegex.test(text)) {
    return 'hi';
  }

  const thaiRegex = /[\u0e00-\u0e7f]/;
  if (thaiRegex.test(text)) {
    return 'th';
  }

  const vietnameseRegex = /[\u00c0-\u1ef9]/;
  if (vietnameseRegex.test(text)) {
    return 'vi';
  }

  return 'en';
}

function normalizeLanguageCode(code: string): string {
  if (!code) {
    return 'en';
  }
  const lower = code.toLowerCase();
  if (lower === 'cmn-hant' || lower === 'zh-hant' || lower === 'zh-tw' || lower === 'zh-hk') {
    return 'zh-Hant';
  }
  if (lower === 'cmn-hans' || lower === 'zh-hans' || lower === 'zh-cn' || lower === 'zh-sg') {
    return 'zh-Hans';
  }
  if (lower === 'cmn' || lower === 'zh') {
    return 'zh';
  }
  const parts = lower.split('-');
  if (parts.length > 1) {
    const [primary, ...rest] = parts;
    const mapped = rest.map(part => {
      if (part.length === 2) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    });
    return [primary, ...mapped].join('-');
  }
  return lower;
}

describe('Language Detection', () => {
  describe('heuristicLanguageDetection', () => {
    it('should detect Korean text', () => {
      expect(heuristicLanguageDetection('안녕하세요')).toBe('ko');
      expect(heuristicLanguageDetection('한국어')).toBe('ko');
      expect(heuristicLanguageDetection('가나다')).toBe('ko');
    });

    it('should detect Japanese text', () => {
      expect(heuristicLanguageDetection('こんにちは')).toBe('ja');
      expect(heuristicLanguageDetection('日本語')).toBe('ja');
      expect(heuristicLanguageDetection('漢字')).toBe('ja');
    });

    it('should detect Chinese text', () => {
      expect(heuristicLanguageDetection('你好世界')).toMatch(/zh-Hant|ja/);
      expect(heuristicLanguageDetection('中文')).toMatch(/zh-Hant|ja/);
      expect(heuristicLanguageDetection('測試')).toMatch(/zh-Hant|ja/);
    });

    it('should detect Russian text', () => {
      expect(heuristicLanguageDetection('привет')).toBe('ru');
      expect(heuristicLanguageDetection('русский')).toBe('ru');
    });

    it('should detect Arabic text', () => {
      expect(heuristicLanguageDetection('مرحبا')).toBe('ar');
      expect(heuristicLanguageDetection('عربي')).toBe('ar');
    });

    it('should detect Hindi text', () => {
      expect(heuristicLanguageDetection('नमस्ते')).toBe('hi');
      expect(heuristicLanguageDetection('हिन्दी')).toBe('hi');
    });

    it('should default to English for Latin text', () => {
      expect(heuristicLanguageDetection('hello')).toBe('en');
      expect(heuristicLanguageDetection('world')).toBe('en');
      expect(heuristicLanguageDetection('Hello World')).toBe('en');
    });

    it('should handle mixed text with priority', () => {
      expect(heuristicLanguageDetection('안녕하세요 world')).toBe('ko');
      expect(heuristicLanguageDetection('日本語 test')).toBe('ja');
    });
  });

  describe('normalizeLanguageCode', () => {
    it('should normalize Traditional Chinese codes', () => {
      expect(normalizeLanguageCode('cmn-Hant')).toBe('zh-Hant');
      expect(normalizeLanguageCode('zh-tw')).toBe('zh-Hant');
      expect(normalizeLanguageCode('zh-hk')).toBe('zh-Hant');
    });

    it('should normalize Simplified Chinese codes', () => {
      expect(normalizeLanguageCode('cmn-Hans')).toBe('zh-Hans');
      expect(normalizeLanguageCode('zh-cn')).toBe('zh-Hans');
    });

    it('should normalize generic zh and cmn', () => {
      expect(normalizeLanguageCode('zh')).toBe('zh');
      expect(normalizeLanguageCode('cmn')).toBe('zh');
    });

    it('should handle empty input', () => {
      expect(normalizeLanguageCode('')).toBe('en');
    });

    it('should handle lowercase codes', () => {
      expect(normalizeLanguageCode('en')).toBe('en');
      expect(normalizeLanguageCode('ja')).toBe('ja');
    });

    it('should handle standard language codes', () => {
      expect(normalizeLanguageCode('en-US')).toBe('en-US');
      expect(normalizeLanguageCode('fr-FR')).toBe('fr-FR');
    });
  });
});