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

// Listen for keyboard events, trigger translation on Shift+Enter
document.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter' && event.shiftKey && activeElement) {
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
        // Check if translation is available for the language pair
        const availability = await Translator.availability({
          sourceLanguage: 'zh-TW', // Use Traditional Chinese as source language
          targetLanguage: targetLang
        });

        if (availability === 'available') {
          // Create translator instance
          const translator = await Translator.create({
            sourceLanguage: 'zh-TW',
            targetLanguage: targetLang
          });

          // Perform translation
          const translatedText = await translator.translate(originalText);
          finalText = translatedText;
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

    // Check if translation is available for the language pair
    const availability = await Translator.availability({
      sourceLanguage: 'zh-TW', // Use Traditional Chinese as source language
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
      sourceLanguage: 'zh-TW',
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
