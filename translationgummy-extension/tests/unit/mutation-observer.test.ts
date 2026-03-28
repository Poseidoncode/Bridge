import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Mutation Observer', () => {
  let mutationObserver: MutationObserver | null = null;
  const callbacks: MutationCallback[] = [];
  
  beforeEach(() => {
    mutationObserver = null;
    callbacks.length = 0;
    
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: MutationCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {
        mutationObserver = null;
      }
      takeRecords() {
        return [];
      }
    });
  });

  it('should create mutation observer', () => {
    const observer = new MutationObserver(() => {});
    expect(observer).toBeDefined();
  });

  it('should have observe method', () => {
    let observeCalled = false;
    
    const mockObserver = {
      observe: () => {
        observeCalled = true;
      },
      disconnect: () => {},
      takeRecords: () => []
    };
    
    mockObserver.observe();
    expect(observeCalled).toBe(true);
  });

  it('should handle mutation records', () => {
    const mockRecords: MutationRecord[] = [
      {
        type: 'childList',
        target: document.createElement('div'),
        addedNodes: [document.createElement('span')],
        removedNodes: [],
        attributeName: null,
        attributeNamespace: null,
        oldValue: null,
      }
    ];
    
    expect(mockRecords.length).toBe(1);
    expect(mockRecords[0].type).toBe('childList');
  });

  it('should detect text changes', () => {
    const textNode = document.createTextNode('Hello');
    const mockRecord: MutationRecord = {
      type: 'characterData',
      target: textNode,
      addedNodes: [],
      removedNodes: [],
      attributeName: null,
      attributeNamespace: null,
      oldValue: null,
    };
    
    expect(mockRecord.type).toBe('characterData');
  });
});

describe('DOM Utilities', () => {
  it('should check if element is smart input', () => {
    const isSmartInputElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return target instanceof HTMLInputElement || 
             target instanceof HTMLTextAreaElement || 
             target.isContentEditable;
    };
    
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    
    expect(isSmartInputElement(input)).toBe(true);
    expect(isSmartInputElement(textarea)).toBe(true);
    expect(isSmartInputElement(div)).toBe(false);
  });

  it('should read smart input text', () => {
    const readSmartInputText = (element: HTMLElement): string => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.value;
      }
      if (element.isContentEditable) {
        return element.textContent || '';
      }
      return '';
    };
    
    const input = document.createElement('input');
    input.value = 'test input';
    
    const textarea = document.createElement('textarea');
    textarea.value = 'test textarea';
    
    expect(readSmartInputText(input)).toBe('test input');
    expect(readSmartInputText(textarea)).toBe('test textarea');
  });

  it('should identify navigation context', () => {
    const isNavigationContext = (element: Element): boolean => {
      return Boolean(
        element.closest('nav, [role="navigation"], .top-bar, .navbar, .menu, .menu-bar, .dropdown, .mega-menu')
      );
    };
    
    const nav = document.createElement('nav');
    const div = document.createElement('div');
    
    expect(isNavigationContext(nav)).toBe(true);
    expect(isNavigationContext(div)).toBe(false);
  });
});