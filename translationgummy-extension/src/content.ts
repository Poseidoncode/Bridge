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

    const originalText = activeElement.isContentEditable ? activeElement.innerText : activeElement.value;
    if (!originalText) return;

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
          activeElement.innerText = finalText;
        } else {
          activeElement.value = finalText;
        }
      }
    } catch (error) {
      console.error("TranslationGummy Translator Error:", error);
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
  const settings = await chrome.storage.sync.get(['targetReadLang']);
  const targetLang = settings.targetReadLang || 'en'; // Default to English for reading translation

  const nodes = document.querySelectorAll('p, h1, h2, h3, li, blockquote');
  const translationPromises = [];
  const originalNodes = [];

  for (const node of nodes) {
    if (node.textContent && node.textContent.trim().length > 10) { // Only translate texts with sufficient length
      originalNodes.push(node);
      translationPromises.push(translateText(node.textContent, targetLang));
    }
  }

  const translatedTexts = await Promise.all(translationPromises);

  originalNodes.forEach((node, index) => {
    const translatedText = translatedTexts[index];
    if (translatedText) {
      // Create a container for bilingual display
      const container = document.createElement('div');
      container.className = 'translationgummy-bilingual-container';
      
      // Clone the original node and wrap it
      const originalClone = node.cloneNode(true) as HTMLElement;
      originalClone.className = 'translationgummy-original';
      
      // Create translated node
      const translatedNode = document.createElement('div');
      translatedNode.className = 'translationgummy-translation';
      translatedNode.textContent = translatedText;
      
      // Append to container
      container.appendChild(originalClone);
      container.appendChild(translatedNode);
      
      // Replace original node with container
      node.parentNode?.replaceChild(container, node);
    }
  });
}

function revertPage() {
  const containers = document.querySelectorAll('.translationgummy-bilingual-container');
  containers.forEach(container => {
    const originalNode = container.querySelector('.translationgummy-original');
    if (originalNode) {
      container.parentNode?.replaceChild(originalNode, container);
    }
  });
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

    // Create translator instance
    const translator = await Translator.create({
      sourceLanguage: detectedSourceLang,
      targetLanguage: targetLang
    });

    // Perform translation
    const result = await translator.translate(text);
    return result;
  } catch (e) {
    console.error("Translation error:", e);
    return `[translated:${targetLang}] ${text}`;
  }
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
