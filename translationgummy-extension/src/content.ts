// File: src/content.ts
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
    try {
      const canCreate = await chrome.ai.canCreateWriter();
      if (canCreate === 'no') {
        console.error("Cannot create AI Writer.");
        return;
      }

      const writer = await chrome.ai.createWriter();
      const prompt = `Translate the following Traditional Chinese text into natural, fluent ${targetLang}. Only provide the translated text without any other explanations: "${originalText}"`;

      const responseStream = await writer.prompt(prompt);

      let fullResponse = "";
      for await (const chunk of responseStream) {
        fullResponse += chunk;
      }

      if (activeElement.isContentEditable) {
        activeElement.innerText = fullResponse;
      } else {
        activeElement.value = fullResponse;
      }

    } catch (error) {
      console.error("TranslationGummy AI Writer Error:", error);
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
  const targetLang = settings.targetReadLang || 'zh-TW';

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
    const canCreate = await chrome.ai.canCreateTextTranslator();
    if (canCreate === 'no') return null;

    const translator = await chrome.ai.createTextTranslator();
    const result = await translator.translate(text, targetLang);
    return result.translatedText;
  } catch (e) {
    console.error("Translation error:", e);
    return null;
  }
}

// Chrome AI API type declarations (experimental)
declare global {
  namespace chrome {
    namespace ai {
      function canCreateTextTranslator(): Promise<'yes' | 'no'>;
      function canCreateWriter(): Promise<'yes' | 'no'>;
      function createTextTranslator(): Promise<TextTranslator>;
      function createWriter(): Promise<Writer>;
    }
  }
}

interface TextTranslator {
  translate(text: string, targetLang: string): Promise<{ translatedText: string }>;
}

interface Writer {
  prompt(prompt: string): AsyncIterable<string>;
}