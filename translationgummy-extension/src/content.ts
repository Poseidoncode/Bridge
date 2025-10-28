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

// Listen for page navigation events
document.addEventListener('DOMContentLoaded', () => {
  console.log('Page DOM loaded, resetting translation state...');
  handlePageNavigation();
});

// Listen for history changes (back/forward navigation)
window.addEventListener('popstate', () => {
  console.log('Page navigation detected, resetting translation state...');
  handlePageNavigation();
});

// Listen for pushstate/replacestate changes (SPA navigation)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  console.log('pushState detected, resetting translation state...');
  handlePageNavigation();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  console.log('replaceState detected, resetting translation state...');
  handlePageNavigation();
};

// Function to handle page navigation
async function handlePageNavigation() {
  try {
    // Clear any existing translations on the page
    revertPage();

    // Reset translation state in storage
    await chrome.storage.local.set({ translationToggleState: false });
    try {
      await chrome.runtime.sendMessage({ action: "resetTranslationStateForTab" });
    } catch (error) {
      console.error("Error notifying background about navigation:", error);
    }

    console.log('Translation state reset due to page navigation');
  } catch (error) {
    console.error('Error handling page navigation:', error);
  }
}

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
          console.log(`Translation model for ${targetLang} needs to be downloaded - starting download...`);

          // Show immediate feedback to user
          if (activeElement) {
            const downloadingText = `[Translation model downloading for ${targetLang}, please wait...] ${originalText}`;
            if (activeElement.isContentEditable) {
              activeElement.textContent = downloadingText;
            } else {
              activeElement.value = downloadingText;
            }
          }

          try {
            // Create translator instance to trigger actual download
            const translator = await Translator.create({
              sourceLanguage: detectedSourceLang,
              targetLanguage: targetLang,
              monitor(m) {
                m.addEventListener('downloadprogress', async (e: ProgressEvent) => {
                  const progress = Math.round((e.loaded / e.total) * 100);
                  console.log(`Downloaded ${progress}% for ${targetLang}`);

                  // Update UI with progress
                  if (activeElement) {
                    const progressText = `[Downloading ${progress}% for ${targetLang}] ${originalText}`;
                    if (activeElement.isContentEditable) {
                      activeElement.textContent = progressText;
                    } else {
                      activeElement.value = progressText;
                    }
                  }

                  // When download is complete (100%), perform translation
                  if (progress >= 100) {
                    console.log(`Download completed for ${targetLang}, starting translation...`);

                    try {
                      // Perform translation with the same translator instance
                      const result = await translator.translate(originalText);

                      console.log(`Translation completed for ${targetLang}: ${originalText} -> ${result}`);

                      // Update UI with final translation
                      if (activeElement) {
                        if (activeElement.isContentEditable) {
                          activeElement.textContent = result;
                          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                          activeElement.value = result;
                          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }

                      return result;
                    } catch (translationError) {
                      console.error('Error during translation after download:', translationError);
                      return `[Translation failed for ${targetLang}] ${originalText}`;
                    }
                  }
                });
              },
            });

            // Return message indicating download has started
            return `[Translation model downloading for ${targetLang}, please wait...] ${originalText}`;
          } catch (downloadError: any) {
            console.error('Error starting model download:', downloadError);

            // Check if this is the "user gesture required" error
            if (downloadError.name === 'NotAllowedError' &&
                downloadError.message.includes('user gesture')) {
              console.log('User gesture required for download, but download may still proceed in background');

              // Wait a bit and check if download actually started despite the error
              await new Promise(resolve => setTimeout(resolve, 2000));

              try {
                // Try to check availability again - if it's now 'downloading', the download started
                const recheckAvailability = await Translator.availability({
                  sourceLanguage: detectedSourceLang,
                  targetLanguage: targetLang
                });

                if (recheckAvailability === 'downloadable') {
                  console.log('Download is actually proceeding despite initial error');
                  return `[Translation model downloading for ${targetLang}, please wait...] ${originalText}`;
                }
              } catch (recheckError) {
                console.log('Could not recheck availability:', recheckError);
              }

              // If we can't confirm, still return downloading message since the error might be misleading
              return `[Translation model downloading for ${targetLang}, please wait...] ${originalText}`;
            }

            // For other types of errors, return failure message
            return `[Download failed for ${targetLang}] ${originalText}`;
          }
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

// Listen for storage changes to auto-update translations when language settings change
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync') {
    const readLangChanged = changes.targetReadLang && changes.targetReadLang.newValue !== changes.targetReadLang.oldValue;
    const writeLangChanged = changes.targetWriteLang && changes.targetWriteLang.newValue !== changes.targetWriteLang.oldValue;

    if (readLangChanged || writeLangChanged) {
      console.log('Language settings changed, reverting and re-translating...');

      // Check if page is currently translated
      const translatedElements = document.querySelectorAll('.translationgummy-translated');
      if (translatedElements.length > 0) {
        console.log('Page is translated, reverting first...');

        // First revert the page to get original content back
        revertPage();

        // Then translate with new language settings after a short delay
        setTimeout(async () => {
          await translatePage();
        }, 100);
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
  } else if (message.action === "updateExistingTranslations") {
    console.log('Updating existing translations...');
    await updateExistingTranslations();
    console.log('Existing translations updated');
  } else if (message.action === "resetTranslationState") {
    console.log('Resetting translation state from popup');
    // This message is sent from content script to itself, no action needed
    sendResponse({ success: true });
    return true;
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

    // Start polling for page translation completion
    pollForPageTranslationCompletion(targetLang);

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
    let downloadPending = false;

    translationResults.forEach((result, index) => {
      const task = tasks[index];
      if (!task) {
        return;
      }

      if (result.status === 'fulfilled' && result.value) {
        if (typeof result.value === 'string' && isModelDownloadPlaceholder(result.value)) {
          downloadPending = true;
          return;
        }

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

    const loadingElement = document.getElementById('translationgummy-loading');
    if (loadingElement) {
      if (downloadPending) {
        loadingElement.textContent = 'Downloading translation model...';
      } else {
        loadingElement.remove();
      }
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
      console.log(`Translation model for ${targetLang} needs to be downloaded - starting download...`);

      try {
        // Create translator instance to trigger actual download
        const translator = await Translator.create({
          sourceLanguage: detectedSourceLang,
          targetLanguage: targetLang,
          monitor(m) {
            m.addEventListener('downloadprogress', async (e: ProgressEvent) => {
              const progress = Math.round((e.loaded / e.total) * 100);
              console.log(`Downloaded ${progress}% for ${targetLang}`);

              // When download is complete (100%), perform translation
              if (progress >= 100) {
                console.log(`Download completed for ${targetLang}, starting translation...`);

                try {
                  // Perform translation with the same translator instance
                  const result = await translator.translate(text);

                  console.log(`Translation completed for ${targetLang}: ${text} -> ${result}`);
                  return result;
                } catch (translationError) {
                  console.error('Error during translation after download:', translationError);
                  return `[Translation failed for ${targetLang}] ${text}`;
                }
              }
            });
          },
        });

        // Return message indicating download has started
        return `[Translation model downloading for ${targetLang}, please wait...] ${text}`;
      } catch (downloadError: any) {
        console.error('Error starting model download:', downloadError);

        // Check if this is the "user gesture required" error
        if (downloadError.name === 'NotAllowedError' &&
            downloadError.message.includes('user gesture')) {
          console.log('User gesture required for download, but download may still proceed in background');

          // Wait a bit and check if download actually started despite the error
          await new Promise(resolve => setTimeout(resolve, 2000));

          try {
            // Try to check availability again - if it's now 'downloading', the download started
            const recheckAvailability = await Translator.availability({
              sourceLanguage: detectedSourceLang,
              targetLanguage: targetLang
            });

            if (recheckAvailability === 'downloadable') {
              console.log('Download is actually proceeding despite initial error');
              return `[Translation model downloading for ${targetLang}, please wait...] ${text}`;
            }
          } catch (recheckError) {
            console.log('Could not recheck availability:', recheckError);
          }

          // If we can't confirm, still return downloading message since the error might be misleading
          return `[Translation model downloading for ${targetLang}, please wait...] ${text}`;
        }

        // For other types of errors, return failure message
        return `[Download failed for ${targetLang}] ${text}`;
      }
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
  // Check for Korean characters first (highest priority for Korean text)
  const koreanRegex = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
  if (koreanRegex.test(text)) {
    return 'ko';
  }

  // Check for Japanese characters
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
  if (japaneseRegex.test(text)) {
    return 'ja';
  }

  // Check for Chinese characters (Traditional and Simplified)
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  if (chineseRegex.test(text)) {
    return 'zh-Hant'; // Assume Traditional Chinese for Chinese text
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

  // Check for Thai characters
  const thaiRegex = /[\u0e00-\u0e7f]/;
  if (thaiRegex.test(text)) {
    return 'th';
  }

  // Check for Vietnamese characters
  const vietnameseRegex = /[\u00c0-\u1ef9]/;
  if (vietnameseRegex.test(text)) {
    return 'vi';
  }

  // Default to English for Latin characters or unknown scripts
  return 'en';
}

// Polling function to check when download is complete and perform page translation
async function pollForPageTranslationCompletion(targetLang: string) {
  const sourceLanguages = new Set<string>();
  let attempts = 0;
  const maxAttempts = 30; // Poll for up to 5 minutes (30 * 10 seconds)

  // First, collect all source languages from the page
  const nodes = document.querySelectorAll<HTMLElement>('p, h1, h2, h3, li, blockquote');
  for (const node of nodes) {
    if (node.classList.contains('translationgummy-translated')) continue;
    if (node.querySelector(':scope > .translationgummy-translation-wrapper')) continue;

    const textContent = node.textContent?.trim();
    if (textContent && textContent.length > 10) {
      const sourceLang = detectLanguage(textContent);
      sourceLanguages.add(sourceLang);
    }
  }

  console.log(`Page translation polling started for target language: ${targetLang}, source languages: ${Array.from(sourceLanguages)}`);

  const pollInterval = setInterval(async () => {
    attempts++;

    try {
      let allAvailable = true;
      const availabilityResults: string[] = [];

      // Check availability for all source-target language pairs
      for (const sourceLang of sourceLanguages) {
        const availability = await Translator.availability({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang
        });
        availabilityResults.push(`${sourceLang}->${targetLang}: ${availability}`);

        if (availability !== 'available') {
          allAvailable = false;

          // If still downloadable, not all downloads are complete
          if (availability === 'downloadable') {
            break;
          }
        }
      }

      console.log(`Availability check (attempt ${attempts}): ${availabilityResults.join(', ')}`);

      if (allAvailable) {
        console.log(`All translation models are now available - performing page translation`);

        // Clear the polling interval
        clearInterval(pollInterval);

        // Perform actual page translation
        await performPageTranslation(targetLang);

      } else if (attempts >= maxAttempts) {
        console.log(`Polling timeout for page translation - stopping after ${maxAttempts} attempts`);
        clearInterval(pollInterval);

        // Update loading indicator to show timeout
        const loadingElement = document.getElementById('translationgummy-loading');
        if (loadingElement) {
          loadingElement.textContent = 'Translation timeout, please try again';
          setTimeout(() => loadingElement.remove(), 3000);
        }
      }
    } catch (error) {
      console.error(`Error polling page translation status:`, error);

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.log(`Page translation polling failed - stopping after ${maxAttempts} attempts`);

        // Update loading indicator to show error
        const loadingElement = document.getElementById('translationgummy-loading');
        if (loadingElement) {
          loadingElement.textContent = 'Translation failed, please try again';
          setTimeout(() => loadingElement.remove(), 3000);
        }
      }
    }
  }, 10000); // Check every 10 seconds
}

// Helper function to perform actual page translation
async function performPageTranslation(targetLang: string) {
  try {
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
    let downloadPending = false;

    translationResults.forEach((result, index) => {
      const task = tasks[index];
      if (!task) {
        return;
      }

      if (result.status === 'fulfilled' && result.value) {
        if (typeof result.value === 'string' && isModelDownloadPlaceholder(result.value)) {
          downloadPending = true;
          return;
        }

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

    // Update loading indicator to show completion
    const loadingElement = document.getElementById('translationgummy-loading');
    if (loadingElement) {
      if (downloadPending) {
        loadingElement.textContent = 'Downloading translation model...';
      } else {
        loadingElement.textContent = 'Translation completed';
        setTimeout(() => loadingElement.remove(), 2000);
      }
    }

  } catch (error) {
    console.error('Error in performPageTranslation:', error);

    // Update loading indicator to show error
    const loadingElement = document.getElementById('translationgummy-loading');
    if (loadingElement) {
      loadingElement.textContent = 'Translation failed, please try again';
      setTimeout(() => loadingElement.remove(), 3000);
    }
  }
}

// Polling function to check when download is complete and perform translation
async function pollForTranslationCompletion(sourceLang: string, targetLang: string, originalText: string) {
  let attempts = 0;
  const maxAttempts = 30; // Poll for up to 5 minutes (30 * 10 seconds)

  const pollInterval = setInterval(async () => {
    attempts++;

    try {
      const availability = await Translator.availability({
        sourceLanguage: sourceLang,
        targetLanguage: targetLang
      });

      if (availability === 'available') {
        console.log(`Translation model for ${targetLang} is now available - performing translation`);

        // Clear the polling interval
        clearInterval(pollInterval);

        // Create translator and perform translation
        const translator = await Translator.create({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang
        });

        const translatedText = await translator.translate(originalText);

        // Post-process translation for Traditional Chinese if needed
        let finalText: string;
        if (targetLang === 'zh-Hant') {
          finalText = ensureTraditionalChinese(translatedText);
        } else {
          finalText = translatedText;
        }

        // Update the active element with the actual translation
        if (activeElement) {
          if (activeElement.isContentEditable) {
            activeElement.textContent = finalText;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            activeElement.value = finalText;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }

        console.log(`Translation completed for ${targetLang}: ${originalText} -> ${finalText}`);
      } else if (availability === 'unavailable') {
        console.log(`Translation model for ${targetLang} became unavailable`);
        clearInterval(pollInterval);

        // Update UI to show error
        if (activeElement) {
          const errorText = `[Translation unavailable for ${targetLang}] ${originalText}`;
          if (activeElement.isContentEditable) {
            activeElement.textContent = errorText;
          } else {
            activeElement.value = errorText;
          }
        }
      } else if (attempts >= maxAttempts) {
        console.log(`Polling timeout for ${targetLang} - stopping after ${maxAttempts} attempts`);
        clearInterval(pollInterval);

        // Update UI to show timeout
        if (activeElement) {
          const timeoutText = `[Translation timeout for ${targetLang}] ${originalText}`;
          if (activeElement.isContentEditable) {
            activeElement.textContent = timeoutText;
          } else {
            activeElement.value = timeoutText;
          }
        }
      }
    } catch (error) {
      console.error(`Error polling translation status for ${targetLang}:`, error);

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.log(`Polling failed for ${targetLang} - stopping after ${maxAttempts} attempts`);
      }
    }
  }, 10000); // Check every 10 seconds
}

function isModelDownloadPlaceholder(text: string): boolean {
  return text.includes('Translation model downloading') || text.includes('Translation model needs to be downloaded');
}

// Function to update existing translations when language settings change
async function updateExistingTranslations() {
  try {
    // Get new target language from storage
    const settings = await chrome.storage.sync.get(['targetReadLang']);
    const newTargetLang = settings.targetReadLang || 'en';

    console.log(`Updating existing translations to language: ${newTargetLang}`);

    // Update block translations
    const translatedElements = document.querySelectorAll<HTMLElement>('.translationgummy-translated');
    for (const element of translatedElements) {
      const originalText = element.dataset.translationgummyOriginal;
      if (originalText) {
        try {
          const translatedText = await translateText(originalText, newTargetLang);
          if (translatedText && !translatedText.startsWith('[')) {
            // Update the translation content
            const existingWrapper = element.querySelector(':scope > .translationgummy-translation-wrapper');
            if (existingWrapper) {
              const translationContent = existingWrapper.querySelector('font.translationgummy-translation-content');
              if (translationContent) {
                translationContent.textContent = translatedText;
              }
            }
          }
        } catch (error) {
          console.error('Error updating block translation:', error);
        }
      }
    }

    // Update inline translations
    const inlineTranslatedElements = document.querySelectorAll<HTMLElement>('.translationgummy-inline-translated');
    for (const element of inlineTranslatedElements) {
      const originalText = element.dataset.translationgummyOriginalInline;
      if (originalText) {
        try {
          const translatedText = await translateText(originalText, newTargetLang);
          if (translatedText && !translatedText.startsWith('[')) {
            replaceTextPreservingChildren(element, translatedText);
          }
        } catch (error) {
          console.error('Error updating inline translation:', error);
        }
      }
    }

    console.log(`Translation update completed for ${newTargetLang}`);
  } catch (error) {
    console.error('Error in updateExistingTranslations:', error);
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
