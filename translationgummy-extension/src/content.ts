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
          if (targetLang === 'zh-TW') {
            // Ensure Traditional Chinese output by converting if necessary
            finalText = ensureTraditionalChinese(translatedText);
          } else {
            finalText = translatedText;
          }
        } else if (availability === 'downloadable') {
          console.log(`Translation model for ${targetLang} needs to be downloaded - download should start automatically`);

          // Show download progress to user with more informative message
          finalText = `[翻譯模型自動下載中 (${targetLang})，請稍候...] ${originalText}`;

          // Note: Chrome automatically starts downloading the model when availability() is called
          // The download happens in the background and may take several minutes
        } else {
          console.warn(`Translation not available for target language: ${targetLang}`);
          finalText = `[翻譯功能暫不可用:${targetLang}] ${originalText}`;
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
        const errorText = `[翻譯錯誤] ${originalText}`;
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
  if (message.action === "translatePage") {
    await translatePage();
  } else if (message.action === "revertPage") {
    revertPage();
  }
});

async function translatePage() {
  try {
    const settings = await chrome.storage.sync.get(['targetReadLang']);
    const targetLang = settings.targetReadLang || 'en'; // Default to English for reading translation

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'translationgummy-loading';
    loadingDiv.textContent = '翻譯中...';
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

    const nodes = document.querySelectorAll('p, h1, h2, h3, li, blockquote');
    const translationPromises = [];
    const originalNodes = [];

    for (const node of nodes) {
      if (node.textContent && node.textContent.trim().length > 10) { // Only translate texts with sufficient length
        originalNodes.push(node);
        translationPromises.push(translateText(node.textContent, targetLang));
      }
    }

    const translatedTexts = await Promise.allSettled(translationPromises);

    originalNodes.forEach((node, index) => {
      const result = translatedTexts[index];
      if (result.status === 'fulfilled' && result.value) {
        try {
          // Instead of creating a container, modify the original node directly
          // Add translation class and data attribute to mark it as translated
          node.classList.add('translationgummy-translated');

          // Store original text for potential reversion
          (node as any).dataset.translationgummyOriginal = node.textContent || '';

          // Create a line break element and translation text
          // const lineBreak = document.createElement('br');
          // const lineBreak2 = document.createElement('br');

          // Create font element to wrap translation text
          const translationFont = document.createElement('font');
          translationFont.className = 'translationgummy-translation';

          // Create translation text node
          const translationTextNode = document.createTextNode(result.value);

          // Append translation text to font element
          translationFont.appendChild(translationTextNode);

          // Append line breaks and translation font to the node
          // node.appendChild(lineBreak);
          // node.appendChild(lineBreak2);
          node.appendChild(translationFont);
        } catch (error) {
          console.error('Error modifying node:', error);
        }
      }
    });

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
    errorDiv.textContent = '翻譯失敗，請稍後再試';
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

function revertPage() {
  try {
    // Find all translated elements and restore their original text
    const translatedElements = document.querySelectorAll('.translationgummy-translated');
    translatedElements.forEach(element => {
      try {
        const originalText = (element as any).dataset.translationgummyOriginal;
        if (originalText !== undefined) {
          element.textContent = originalText;
          element.classList.remove('translationgummy-translated');
          delete (element as any).dataset.translationgummyOriginal;
        }
      } catch (error) {
        console.error('Error reverting element:', error);
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
      return `[翻譯模型下載中，請稍候...] ${text}`;
    } else if (availability !== 'available') {
      console.warn(`Translation not available for target language: ${targetLang}`);
      return `[翻譯功能暫不可用:${targetLang}] ${text}`;
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
      return `[翻譯器創建失敗:${targetLang}] ${text}`;
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
    return `[翻譯錯誤:${targetLang}] ${text}`;
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
    return 'zh-TW'; // Assume Traditional Chinese for Chinese text
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
