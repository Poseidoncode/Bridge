// File: src/content.ts
// Debug marker to help tests detect if content script was injected
;(window as any).__TRANSLATIONGUMMY_CONTENT_SCRIPT_LOADED = true;
console.log("TranslationGummy Content Script Loaded.");

let activeElement: HTMLInputElement | HTMLTextAreaElement | null = null;

// Listen for input focus events
document.addEventListener('focusin', (event) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    activeElement = target as HTMLInputElement | HTMLTextAreaElement;
  }
});

// Listen for keyboard events, trigger translation on Shift+S
document.addEventListener('keydown', async (event) => {
  if (event.key === 'S' && event.shiftKey && activeElement) {
    event.preventDefault(); // Prevent default newline behavior

    const originalText = activeElement.isContentEditable ? activeElement.textContent || '' : activeElement.value;
    if (!originalText.trim()) return;

    // Get target language from chrome.storage
    const settings = await chrome.storage.sync.get(['targetWriteLang']);
    const targetLang = settings.targetWriteLang || 'en'; // Default to English if not set
    let finalText: string | null = null;

    try {
      // Check if Translator API is available
      if (typeof Translator !== 'undefined') {
        // For input translation, we need to detect the source language properly
        // Since 'auto' doesn't work, we'll use a simple heuristic
        const detectedSourceLang = detectLanguage(originalText);

        // Check if translation is available for the language pair
        const availability = await Translator.availability({
          sourceLanguage: detectedSourceLang,
          targetLanguage: targetLang
        });

        if (availability === 'available') {
          // Create translator instance with explicit language specification
          const translator = await Translator.create({
            sourceLanguage: detectedSourceLang,
            targetLanguage: targetLang
          });

          // Perform translation
          const translatedText = await translator.translate(originalText);

          // Post-process translation for Traditional Chinese if needed
          if (targetLang === 'zh-Hant') {
            // Ensure Traditional Chinese output by converting if necessary
            finalText = ensureTraditionalChinese(translatedText);
          } else {
            finalText = translatedText;
          }
        } else if (availability === 'downloadable') {
          console.log(`Translation model for ${targetLang} needs to be downloaded - download should start automatically`);

          // Show download progress to user with more informative message
          finalText = `[Translation model is downloading (${targetLang}) — please wait...] ${originalText}`;

          // Note: Chrome automatically starts downloading the model when availability() is called
          // The download happens in the background and may take several minutes
        } else {
          console.warn(`Translation not available for target language: ${targetLang}`);
          finalText = `[Translation temporarily unavailable: ${targetLang}] ${originalText}`;
        }
      } else {
        // Fallback for browsers that don't support Translator API yet
        console.warn('Translator API not supported — using fallback translation for testing');
        finalText = `[translated:${targetLang}] ${originalText}`;
      }

      if (finalText !== null) {
        if (activeElement.isContentEditable) {
          // Use textContent for contentEditable elements to avoid HTML parsing issues
          activeElement.textContent = finalText;
          // Trigger input event to ensure any listeners are notified
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          activeElement.value = finalText;
          // Trigger input event for regular input elements
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    } catch (error) {
      console.error("TranslationGummy Translator Error:", error);
      // Provide user feedback on error
      if (activeElement) {
        const errorText = `[Translation error] ${originalText}`;
        if (activeElement.isContentEditable) {
          activeElement.textContent = errorText;
        } else {
          activeElement.value = errorText;
        }
      }
    }
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Content script received message:', message.action, 'from', sender);

  if (message.action === "translatePage") {
    console.log('Starting page translation...');
    await translatePage();
    console.log('Page translation completed');
  } else if (message.action === "revertPage") {
    console.log('Starting page revert...');
    revertPage();
    console.log('Page revert completed');
  } else if (message.action === "getPageTranslationStatus") {
    // Return current page translation status
    const translatedElements = document.querySelectorAll('.translationgummy-translated');
    const translationWrappers = document.querySelectorAll('.translationgummy-translation-wrapper');
    const allElements = document.querySelectorAll('*');

    // More detailed debugging
    let translatedInfo: string[] = [];
    translatedElements.forEach((el, index) => {
      translatedInfo.push(`${el.tagName}: "${el.textContent?.substring(0, 30)}..."`);
    });

    console.log(`Status check: ${translatedElements.length} translated elements, ${translationWrappers.length} translation wrappers found`);
    console.log('Translated elements:', translatedInfo);
    console.log('Total elements on page:', allElements.length);

    sendResponse({
      isTranslated: translatedElements.length > 0,
      translatedCount: translatedElements.length,
      wrapperCount: translationWrappers.length,
      debugInfo: {
        translatedElements: translatedInfo,
        totalElements: allElements.length
      }
    });
    return true; // Keep message channel open for async response
  }
});

async function translatePage() {
  try {
    const settings = await chrome.storage.sync.get(['targetReadLang']);
    const targetLang = settings.targetReadLang || 'en'; // Default to English for reading translation

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'translationgummy-loading';
    loadingDiv.textContent = 'Translating...';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007bff;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;
    document.body.appendChild(loadingDiv);

    const nodes = document.querySelectorAll<HTMLElement>('p, h1, h2, h3, li, blockquote');

    type TranslationTask = {
      element: HTMLElement;
      mode: 'block' | 'inline';
      originalText: string;
    };

    const tasks: TranslationTask[] = [];

    for (const node of nodes) {
      // Skip nodes that are already translated or already contain our translation wrapper
      if (node.classList.contains('translationgummy-translated')) continue;
      if (node.querySelector(':scope > .translationgummy-translation-wrapper')) continue;

      const inlineTargets = getInlineTranslationTargets(node);
      if (inlineTargets.length > 0) {
        inlineTargets.forEach(target => {
          if (target.classList.contains('translationgummy-inline-translated')) {
            return;
          }

          const inlineText = getInlineOriginalText(target);
          if (!inlineText) {
            return;
          }

          tasks.push({
            element: target,
            mode: 'inline',
            originalText: inlineText
          });
        });
        // Avoid translating the entire list item when inline targets were discovered
        continue;
      }

      if (node.tagName === 'LI' && isNavigationContext(node)) {
        // Complex navigation list-items get handled via inline targets or skipped to avoid layout breaks
        continue;
      }

      const textContent = node.textContent?.trim();
      if (!textContent) continue;
      if (textContent.length <= 10) continue; // Only translate sufficiently long block texts

      tasks.push({
        element: node,
        mode: 'block',
        originalText: textContent
      });
    }

    const translationResults = await Promise.allSettled(
      tasks.map(task => translateText(task.originalText, targetLang))
    );

    let successCount = 0;

    translationResults.forEach((result, index) => {
      const task = tasks[index];
      if (!task) {
        return;
      }

      if (result.status === 'fulfilled' && result.value) {
        if (task.mode === 'inline' && result.value.startsWith('[')) {
          console.warn('Skipping inline translation due to fallback result:', result.value);
          return;
        }

        if (task.mode === 'inline') {
          applyInlineTranslation(task.element, result.value);
        } else {
          applyBlockTranslation(task.element, result.value);
        }

        successCount += 1;
      } else {
        console.warn(
          `Translation failed for task ${index}:`,
          result.status === 'rejected' ? result.reason : 'No result'
        );
      }
    });

    const inlineTaskCount = tasks.filter(task => task.mode === 'inline').length;
    const blockTaskCount = tasks.length - inlineTaskCount;
    console.log(
      `Translation completed: ${tasks.length} tasks processed (block: ${blockTaskCount}, inline: ${inlineTaskCount}), ${successCount} successful translations`
    );

    // Remove loading indicator
    const loadingElement = document.getElementById('translationgummy-loading');
    if (loadingElement) {
      loadingElement.remove();
    }

  } catch (error) {
    console.error('Error in translatePage:', error);

    // Remove loading indicator on error
    const loadingElement = document.getElementById('translationgummy-loading');
    if (loadingElement) {
      loadingElement.remove();
    }

    // Show error message briefly
    const errorDiv = document.createElement('div');
    errorDiv.textContent = 'Translation failed, please try again later';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }
}

function isNavigationContext(element: Element): boolean {
  return Boolean(
    element.closest('nav, [role="navigation"], .top-bar, .navbar, .menu, .menu-bar, .dropdown, .mega-menu')
  );
}

function getInlineTranslationTargets(node: HTMLElement): HTMLElement[] {
  if (node.tagName !== 'LI') {
    return [];
  }

  if (!isNavigationContext(node)) {
    return [];
  }

  const targets: HTMLElement[] = [];
  const directChildren = Array.from(node.children);

  for (const child of directChildren) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    if (child.matches('a, button')) {
      if (hasDirectTextNode(child)) {
        targets.push(child);
      }
      continue;
    }

    if (child.matches('span') && child.childElementCount === 0 && hasDirectTextNode(child)) {
      targets.push(child);
    }
  }

  return targets;
}

function hasDirectTextNode(element: HTMLElement): boolean {
  return Array.from(element.childNodes).some(node => {
    if (node.nodeType !== Node.TEXT_NODE) {
      return false;
    }
    return Boolean(node.textContent && node.textContent.trim());
  });
}

function applyInlineTranslation(element: HTMLElement, translatedText: string): void {
  if (!element.dataset.translationgummyOriginalInline) {
    element.dataset.translationgummyOriginalInline = getInlineOriginalText(element);
  }

  replaceTextPreservingChildren(element, translatedText);
  element.classList.add('translationgummy-inline-translated');
}

function getInlineOriginalText(element: HTMLElement): string {
  const directTextNode = Array.from(element.childNodes).find((node): node is Text => {
    if (node.nodeType !== Node.TEXT_NODE) {
      return false;
    }
    return Boolean(node.textContent && node.textContent.trim());
  });

  if (directTextNode?.textContent) {
    return directTextNode.textContent.trim();
  }

  return element.textContent?.trim() ?? '';
}

function applyBlockTranslation(element: HTMLElement, translatedText: string): void {
  element.classList.add('translationgummy-translated');

  const existingWrapper = element.querySelector(':scope > .translationgummy-translation-wrapper');
  if (existingWrapper) {
    const translationContent = existingWrapper.querySelector('font.translationgummy-translation-content');
    if (translationContent) {
      translationContent.textContent = translatedText;
    }
    return;
  }

  if (!element.dataset.translationgummyOriginal) {
    element.dataset.translationgummyOriginal = element.textContent || '';
  }

  if (shouldInsertLineBreak(element)) {
    const lineBreak = document.createElement('br');
    lineBreak.dataset.translationgummyInjected = 'line-break';
    element.appendChild(lineBreak);
  }

  const translationWrapper = document.createElement('span');
  translationWrapper.className = 'translationgummy-translation-wrapper';
  translationWrapper.dataset.translationgummyInjected = 'translation';

  const translationContentFont = document.createElement('font');
  translationContentFont.className = 'translationgummy-translation-content';
  translationContentFont.textContent = translatedText;

  translationWrapper.appendChild(translationContentFont);
  element.appendChild(translationWrapper);

  console.log(`Translation attached to node: ${element.tagName} - "${element.textContent?.substring(0, 50)}..."`);
}

function replaceTextPreservingChildren(element: HTMLElement, newText: string): void {
  const textNodes = Array.from(element.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE
  );

  let replaced = false;

  for (const textNode of textNodes) {
    const rawText = textNode.textContent ?? '';
    const trimmed = rawText.trim();

    if (!trimmed) {
      continue;
    }

    if (!replaced) {
      const leadingWhitespace = rawText.match(/^\s*/)?.[0] ?? '';
      const trailingWhitespace = rawText.match(/\s*$/)?.[0] ?? '';
      textNode.textContent = `${leadingWhitespace}${newText}${trailingWhitespace}`;
      replaced = true;
    } else {
      textNode.textContent = '';
    }
  }

  if (!replaced) {
    element.insertBefore(document.createTextNode(newText), element.firstChild);
  }
}

function shouldInsertLineBreak(node: HTMLElement): boolean {
  try {
    const display = window.getComputedStyle(node).display;
    return display !== 'inline' && display !== 'inline-block';
  } catch (error) {
    console.warn('Unable to determine computed style for line break calculation:', error);
    return true;
  }
}

function revertPage() {
  try {
    // Find all translated elements and restore their original text
    const translatedElements = document.querySelectorAll<HTMLElement>('.translationgummy-translated');
    translatedElements.forEach(element => {
      try {
        const wrappers = element.querySelectorAll(':scope > .translationgummy-translation-wrapper');
        wrappers.forEach(wrapperNode => {
          const wrapper = wrapperNode as HTMLElement;
          const previousSibling = wrapper.previousSibling;
          if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE) {
            const previousElement = previousSibling as HTMLElement;
            if (
              previousElement.dataset.translationgummyInjected === 'line-break' ||
              previousElement.tagName === 'BR'
            ) {
              previousElement.remove();
            }
          }
          wrapper.remove();
        });

        const injectedLineBreaks = element.querySelectorAll(':scope > [data-translationgummy-injected="line-break"]');
        injectedLineBreaks.forEach(lineBreak => lineBreak.remove());

        element.classList.remove('translationgummy-translated');
        delete element.dataset.translationgummyOriginal;
      } catch (error) {
        console.error('Error reverting element:', error);
      }
    });

    const inlineTranslatedElements = document.querySelectorAll<HTMLElement>('.translationgummy-inline-translated');
    inlineTranslatedElements.forEach(element => {
      try {
        const originalText = element.dataset.translationgummyOriginalInline;
        if (originalText !== undefined) {
          replaceTextPreservingChildren(element, originalText);
          delete element.dataset.translationgummyOriginalInline;
        }
        element.classList.remove('translationgummy-inline-translated');
      } catch (error) {
        console.error('Error reverting inline element:', error);
      }
    });

    // Handle legacy containers (for backward compatibility)
    const containers = document.querySelectorAll('.translationgummy-bilingual-container, .translationgummy-vertical-container');
    containers.forEach(container => {
      try {
        const originalNode = container.querySelector('.translationgummy-original');
        if (originalNode && container.parentNode) {
          container.parentNode.replaceChild(originalNode, container);
        }
      } catch (error) {
        console.error('Error reverting legacy container:', error);
      }
    });

    // Also remove any loading indicators that might be left over
    const loadingElement = document.getElementById('translationgummy-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
  } catch (error) {
    console.error('Error in revertPage:', error);
  }
}

async function translateText(text: string, targetLang: string): Promise<string | null> {
  try {
    // Check if Translator API is supported
    if (typeof Translator === 'undefined') {
      console.warn('Translator API not supported');
      return `[translated:${targetLang}] ${text}`;
    }

    // Detect source language from text content
    const detectedSourceLang = detectLanguage(text);

    // Check if translation is available for the language pair
    const availability = await Translator.availability({
      sourceLanguage: detectedSourceLang,
      targetLanguage: targetLang
    });

    if (availability === 'downloadable') {
      console.log(`Translation model for ${targetLang} needs to be downloaded`);
      return `[Translation model downloading, please wait...] ${text}`;
    } else if (availability !== 'available') {
      console.warn(`Translation not available for target language: ${targetLang}`);
      return `[Translation temporarily unavailable: ${targetLang}] ${text}`;
    }

    // Create translator instance with error handling
    let translator;
    try {
      translator = await Translator.create({
        sourceLanguage: detectedSourceLang,
        targetLanguage: targetLang
      });
    } catch (createError) {
      console.error('Error creating translator:', createError);
      return `[Failed to create translator: ${targetLang}] ${text}`;
    }

    // Perform translation with timeout
    const result = await Promise.race([
      translator.translate(text),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Translation timeout')), 10000)
      )
    ]);

    return result;
  } catch (e) {
    console.error("Translation error:", e);
    return `[Translation error: ${targetLang}] ${text}`;
  }
}

// Function to ensure Traditional Chinese output
function ensureTraditionalChinese(text: string): string {
  // If the text contains mostly Simplified Chinese characters, convert to Traditional
  // This is a basic implementation - for production, consider using a proper conversion library

  // Check if text contains Simplified Chinese characters
  const simplifiedChineseChars = ['爱', '为', '会', '国', '学', '生', '们', '说', '来', '去', '时', '年', '月', '日', '人', '大', '小', '长', '高', '低'];
  const containsSimplified = simplifiedChineseChars.some(char => text.includes(char));

  if (containsSimplified) {
    // Basic character mapping for common Simplified to Traditional conversions
    let converted = text
      .replace(/爱/g, '愛')
      .replace(/为/g, '為')
      .replace(/会/g, '會')
      .replace(/国/g, '國')
      .replace(/学/g, '學')
      .replace(/生/g, '生') // This one is the same
      .replace(/们/g, '們')
      .replace(/说/g, '說')
      .replace(/来/g, '來')
      .replace(/去/g, '去') // This one is the same
      .replace(/时/g, '時')
      .replace(/年/g, '年') // This one is the same
      .replace(/月/g, '月') // This one is the same
      .replace(/日/g, '日') // This one is the same
      .replace(/人/g, '人') // This one is the same
      .replace(/大/g, '大') // This one is the same
      .replace(/小/g, '小') // This one is the same
      .replace(/长/g, '長')
      .replace(/高/g, '高') // This one is the same
      .replace(/低/g, '低'); // This one is the same

    return converted;
  }

  return text;
}

// Simple language detection function
function detectLanguage(text: string): string {
  // Check for Chinese characters (Traditional and Simplified)
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  if (chineseRegex.test(text)) {
    return 'zh-Hant'; // Assume Traditional Chinese for Chinese text
  }

  // Check for Japanese characters
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
  if (japaneseRegex.test(text)) {
    return 'ja';
  }

  // Check for Korean characters
  const koreanRegex = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
  if (koreanRegex.test(text)) {
    return 'ko';
  }

  // Check for Cyrillic characters (Russian, etc.)
  const cyrillicRegex = /[\u0400-\u04ff]/;
  if (cyrillicRegex.test(text)) {
    return 'ru';
  }

  // Check for Arabic characters
  const arabicRegex = /[\u0600-\u06ff]/;
  if (arabicRegex.test(text)) {
    return 'ar';
  }

  // Check for Devanagari characters (Hindi, etc.)
  const devanagariRegex = /[\u0900-\u097f]/;
  if (devanagariRegex.test(text)) {
    return 'hi';
  }

  // Default to English for Latin characters or unknown scripts
  return 'en';
}

// Translator API type declarations
declare global {
  // Translator API (global scope)
  var Translator: {
    availability(options: {
      sourceLanguage: string;
      targetLanguage: string;
    }): Promise<'available' | 'unavailable' | 'downloadable'>;
    create(options: {
      sourceLanguage: string;
      targetLanguage: string;
      monitor?: (m: any) => void;
    }): Promise<TranslatorInstance>;
  };

  interface TranslatorInstance {
    translate(text: string): Promise<string>;
    translateStreaming(text: string): AsyncIterable<string>;
  }
}
