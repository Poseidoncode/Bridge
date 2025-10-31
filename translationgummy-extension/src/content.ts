// File: src/content.ts
// Debug marker to help tests detect if content script was injected
;(window as any).__TRANSLATIONbridge_CONTENT_SCRIPT_LOADED = true;
console.log("Translationbridge Content Script Loaded.");

let activeElement: HTMLElement | null = null;
let autoTranslateEnabled = false;
let pendingFullTranslationTimer: number | null = null;
let observerSetupTimer: number | null = null;
let mutationObserver: MutationObserver | null = null;
let translationQueue: Promise<void> = Promise.resolve();
let currentTargetReadLang = 'en';
let initialSyncPerformed = false;
let mutationSuppressed = false;
let mutationDeferred = false;
const smartInputSources = new WeakMap<HTMLElement, string>();
const smartInputDebugElements = new WeakMap<HTMLElement, HTMLElement>();
let suppressSmartInputTracking = false;
let smartInputIdCounter = 0;
let smartInputDisplayEnabled = false;
let smartInputHintShown = false;
let smartInputHintTimer: number | null = null;
let smartInputStatusElement: HTMLElement | null = null;
let smartInputStatusTimer: number | null = null;
let languageDetectorPromise: Promise<LanguageDetectorInstance | null> | null = null;
let languageDetectorBlocked = false;

interface LanguageDetectorInstance {
  detect(text: string): Promise<Array<{ detectedLanguage: string; confidence: number }>>;
}

type TranslatePageOptions = {
  showIndicator?: boolean;
  targetLang?: string;
  skipPolling?: boolean;
};

function isSmartInputElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

function readSmartInputText(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  if (element.isContentEditable) {
    return element.textContent || '';
  }
  return '';
}

function setSmartInputElementValue(element: HTMLElement, text: string, triggerInput = true): void {
  suppressSmartInputTracking = true;
  try {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = text;
    } else if (element.isContentEditable) {
      element.textContent = text;
    }
    if (triggerInput) {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } finally {
    suppressSmartInputTracking = false;
  }
}

function updateSmartInputDisplay(element: HTMLElement, text: string): void {
  removeSmartInputDebug(element);
  // Smart Input debug UI temporarily disabled; restore by uncommenting the block below.
  /*
  if (!smartInputDisplayEnabled) {
    removeSmartInputDebug(element);
    return;
  }
  cleanupOrphanSmartInputDebugs();
  let debug = smartInputDebugElements.get(element) || null;
  if (debug && !debug.isConnected) {
    smartInputDebugElements.delete(element);
    debug = null;
  }
  if (!element.dataset.translationbridgeSmartInputId) {
    smartInputIdCounter += 1;
    element.dataset.translationbridgeSmartInputId = `si-${smartInputIdCounter}`;
  }
  const targetId = element.dataset.translationbridgeSmartInputId || '';
  cleanupSmartInputDebugSiblings(element, debug);
  if (!debug) {
    debug = document.createElement('div');
    debug.dataset.translationbridgeInjected = 'smart-input-debug';
    debug.className = 'translationbridge-smart-input-debug';
    debug.style.cssText = 'margin-top:4px;font-size:12px;color:#555;font-family:Arial,sans-serif;';
    if (element.parentElement) {
      element.insertAdjacentElement('afterend', debug);
    } else {
      document.body.appendChild(debug);
    }
    smartInputDebugElements.set(element, debug);
  }
  if (debug.previousElementSibling !== element) {
    element.insertAdjacentElement('afterend', debug);
  }
  debug.dataset.translationbridgeSmartInputFor = targetId;
  const displayText = text.length > 500 ? `${text.slice(0, 500)}...` : text;
  debug.textContent = displayText ? `Smart Input source: ${displayText}` : 'Smart Input source: (empty)';
  */
}

function removeSmartInputDebug(element: HTMLElement): void {
  const debug = smartInputDebugElements.get(element);
  if (debug) {
    debug.remove();
    smartInputDebugElements.delete(element);
  }
}

function cleanupSmartInputDebugSiblings(element: HTMLElement, keep: HTMLElement | null): void {
  let sibling: Element | null = element.nextElementSibling;
  while (sibling) {
    const next = sibling.nextElementSibling;
    if (sibling instanceof HTMLElement && sibling.dataset.translationbridgeInjected === 'smart-input-debug' && sibling !== keep) {
      sibling.remove();
    }
    sibling = next;
  }
}

function cleanupOrphanSmartInputDebugs(): void {
  const nodes = document.querySelectorAll<HTMLElement>('[data-translationbridge-injected="smart-input-debug"]');
  nodes.forEach(node => {
    const targetId = node.dataset.translationbridgeSmartInputFor;
    if (!targetId) {
      node.remove();
      return;
    }
    const anchor = document.querySelector<HTMLElement>(`[data-translationbridge-smart-input-id="${targetId}"]`);
    if (!anchor || !anchor.isConnected) {
      node.remove();
    }
  });
}

function enableSmartInputDisplay(element: HTMLElement, text: string): void {
  if (!smartInputDisplayEnabled) {
    smartInputDisplayEnabled = true;
    showSmartInputHint();
  }
  updateSmartInputDisplay(element, text);
}

function resetSmartInputPresentation(): void {
  smartInputDisplayEnabled = false;
  smartInputHintShown = false;
  if (smartInputHintTimer !== null) {
    clearTimeout(smartInputHintTimer);
    smartInputHintTimer = null;
  }
  hideSmartInputStatus();
  const hint = document.getElementById('translationbridge-smart-input-hint');
  if (hint) {
    hint.remove();
  }
  const nodes = document.querySelectorAll<HTMLElement>('[data-translationbridge-injected="smart-input-debug"]');
  nodes.forEach(node => node.remove());
}

function showSmartInputHint(): void {
  if (smartInputHintShown) {
    return;
  }
  smartInputHintShown = true;
  const existing = document.getElementById('translationbridge-smart-input-hint');
  if (existing) {
    existing.remove();
  }
  const hint = document.createElement('div');
  hint.id = 'translationbridge-smart-input-hint';
  hint.textContent = 'Smart Input source enabled. Original text appears below inputs.';
  hint.style.cssText = 'position:fixed;bottom:24px;right:24px;max-width:260px;background:#111827;color:#f9fafb;padding:12px 16px;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,0.35);z-index:10001;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;';
  document.body.appendChild(hint);
  if (smartInputHintTimer !== null) {
    clearTimeout(smartInputHintTimer);
  }
  smartInputHintTimer = window.setTimeout(() => {
    hint.remove();
    smartInputHintTimer = null;
  }, 3200);
}

function ensureSmartInputStatusElement(): HTMLElement {
  if (!smartInputStatusElement || !smartInputStatusElement.isConnected) {
    smartInputStatusElement = document.createElement('div');
    smartInputStatusElement.id = 'translationbridge-smart-input-status';
    smartInputStatusElement.dataset.translationbridgeInjected = 'smart-input-status';
    smartInputStatusElement.style.cssText = 'position:fixed;bottom:24px;right:24px;max-width:320px;background:#1d4ed8;color:#f8fafc;padding:12px 18px;border-radius:10px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;box-shadow:0 18px 30px rgba(15,23,42,0.35);z-index:10002;pointer-events:none;border:1px solid rgba(96,165,250,0.4);transition:opacity 0.2s ease;opacity:1;';
    document.body.appendChild(smartInputStatusElement);
  }
  return smartInputStatusElement;
}

function showSmartInputStatus(message: string, tone: 'info' | 'success' | 'error' = 'info', persistent = false, duration = 3200): void {
  const element = ensureSmartInputStatusElement();
  element.textContent = message;
  if (tone === 'success') {
    element.style.background = '#15803d';
    element.style.borderColor = 'rgba(74,222,128,0.45)';
  } else if (tone === 'error') {
    element.style.background = '#b91c1c';
    element.style.borderColor = 'rgba(248,113,113,0.45)';
  } else {
    element.style.background = '#1d4ed8';
    element.style.borderColor = 'rgba(96,165,250,0.4)';
  }
  element.style.opacity = '1';
  if (smartInputStatusTimer !== null) {
    clearTimeout(smartInputStatusTimer);
    smartInputStatusTimer = null;
  }
  if (!persistent) {
    smartInputStatusTimer = window.setTimeout(() => {
      hideSmartInputStatus();
    }, duration);
  }
}

function hideSmartInputStatus(): void {
  if (smartInputStatusTimer !== null) {
    clearTimeout(smartInputStatusTimer);
    smartInputStatusTimer = null;
  }
  if (smartInputStatusElement) {
    const element = smartInputStatusElement;
    smartInputStatusElement = null;
    element.style.opacity = '0';
    window.setTimeout(() => {
      element.remove();
    }, 200);
  }
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

async function getLanguageDetector(force = false): Promise<LanguageDetectorInstance | null> {
  if (languageDetectorBlocked && !force) {
    return null;
  }
  if (typeof LanguageDetector === 'undefined') {
    return null;
  }
  if (!languageDetectorPromise || force) {
    const creation = LanguageDetector.create().then(detector => {
      languageDetectorBlocked = false;
      return detector;
    }).catch(error => {
      languageDetectorPromise = null;
      if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'NotAllowedError') {
        languageDetectorBlocked = true;
      }
      console.error('LanguageDetector create failed:', error);
      return null;
    });
    languageDetectorPromise = creation;
  }
  const instance = await languageDetectorPromise;
  if (!instance) {
    languageDetectorBlocked = true;
  }
  return instance;
}

async function detectLanguageWithChrome(text: string): Promise<string | null> {
  if (!chrome.i18n || !chrome.i18n.detectLanguage) {
    return null;
  }
  try {
    const result = await chrome.i18n.detectLanguage(text);
    const top = result?.languages?.[0];
    if (top?.language) {
      return normalizeLanguageCode(top.language);
    }
  } catch (error) {
    console.error('chrome.i18n.detectLanguage failed:', error);
  }
  return null;
}

async function detectLanguageAccurate(text: string, forceDetector = false): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'en';
  }
  const limited = trimmed.length > 4000 ? trimmed.slice(0, 4000) : trimmed;
  const detector = await getLanguageDetector(forceDetector);
  if (detector) {
    try {
      const results = await detector.detect(limited);
      const top = results?.[0];
      if (top?.detectedLanguage) {
        return normalizeLanguageCode(top.detectedLanguage);
      }
    } catch (error) {
      console.error('LanguageDetector detect failed:', error);
    }
  }
  const chromeResult = await detectLanguageWithChrome(limited);
  if (chromeResult) {
    return chromeResult;
  }
  return heuristicLanguageDetection(limited);
}

// Listen for input focus events
document.addEventListener('focusin', (event) => {
  cleanupOrphanSmartInputDebugs();
  const target = event.target;
  if (isSmartInputElement(target)) {
    activeElement = target;
    const stored = smartInputSources.get(target);
    const currentText = stored !== undefined ? stored : readSmartInputText(target);
    if (stored === undefined) {
      smartInputSources.set(target, currentText);
    }
    updateSmartInputDisplay(target, currentText);
    return;
  }
  activeElement = null;
});

document.addEventListener('input', (event) => {
  cleanupOrphanSmartInputDebugs();
  if (suppressSmartInputTracking) {
    return;
  }
  const target = event.target;
  if (!isSmartInputElement(target)) {
    return;
  }
  const text = readSmartInputText(target);
  smartInputSources.set(target, text);
  updateSmartInputDisplay(target, text);
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

function ensureMutationObserver() {
  if (!autoTranslateEnabled) {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (observerSetupTimer !== null) {
      clearTimeout(observerSetupTimer);
      observerSetupTimer = null;
    }
    return;
  }
  if (!document.body) {
    if (observerSetupTimer === null) {
      observerSetupTimer = window.setTimeout(() => {
        observerSetupTimer = null;
        ensureMutationObserver();
      }, 100);
    }
    return;
  }
  if (mutationObserver) {
    return;
  }
  mutationObserver = new MutationObserver(handleMutations);
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function handleMutations(records: MutationRecord[]) {
  if (!autoTranslateEnabled) {
    return;
  }
  if (mutationSuppressed) {
    mutationDeferred = true;
    return;
  }
  for (const record of records) {
    if (record.type === 'childList') {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLElement) {
          if (node.classList.contains('translationbridge-translation-wrapper')) {
            continue;
          }
          if ((node as HTMLElement).dataset.translationbridgeInjected) {
            continue;
          }
          scheduleFullTranslation(600, {
            showIndicator: false,
            skipPolling: true,
            targetLang: currentTargetReadLang,
          });
          return;
        }
        if (node instanceof Text) {
          const parent = node.parentElement;
          if (parent && (parent.classList.contains('translationbridge-translation-content') || parent.dataset.translationbridgeInjected)) {
            continue;
          }
          if (node.textContent && node.textContent.trim()) {
            scheduleFullTranslation(600, {
              showIndicator: false,
              skipPolling: true,
              targetLang: currentTargetReadLang,
            });
            return;
          }
        }
      }
    } else if (record.type === 'characterData') {
      const parent = (record.target as CharacterData).parentElement;
      if (parent && (parent.classList.contains('translationbridge-translation-content') || parent.dataset.translationbridgeInjected)) {
        continue;
      }
      scheduleFullTranslation(600, {
        showIndicator: false,
        skipPolling: true,
        targetLang: currentTargetReadLang,
      });
      return;
    }
  }
}

function scheduleFullTranslation(delay: number, options: TranslatePageOptions = {}) {
  if (!autoTranslateEnabled) {
    return;
  }
  if (pendingFullTranslationTimer !== null) {
    clearTimeout(pendingFullTranslationTimer);
  }
  pendingFullTranslationTimer = window.setTimeout(() => {
    pendingFullTranslationTimer = null;
    if (!autoTranslateEnabled) {
      return;
    }
    translationQueue = translationQueue
      .then(() => translatePage(options))
      .catch(error => {
        console.error('Scheduled translation failed:', error);
      });
  }, delay);
}

async function syncTabTranslationState(triggerFull: boolean, delay = 0) {
  let enabled = false;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTabTranslationState' });
    enabled = Boolean(response?.enabled);
  } catch (error) {
    try {
      const fallback = await chrome.storage.local.get(['translationToggleState']);
      enabled = Boolean(fallback.translationToggleState);
    } catch (storageError) {
      enabled = false;
    }
  }
  autoTranslateEnabled = enabled;
  ensureMutationObserver();
  if (triggerFull && enabled) {
    scheduleFullTranslation(delay, {
      showIndicator: true,
    });
  }
  if (!initialSyncPerformed) {
    initialSyncPerformed = true;
  }
}

void syncTabTranslationState(false);

// Function to handle page navigation
async function handlePageNavigation() {
  try {
    resetSmartInputPresentation();
    revertPage();
    await syncTabTranslationState(true, 400);
  } catch (error) {
    console.error('Error handling page navigation:', error);
  }
}

document.addEventListener('keydown', async (event) => {
  if (event.key === 'S' && event.shiftKey && activeElement && isSmartInputElement(activeElement)) {
    event.preventDefault();
    const element = activeElement;
    const stored = smartInputSources.get(element);
    const currentText = readSmartInputText(element);
    let sourceText = stored !== undefined ? stored : currentText;
    if (!sourceText.trim()) {
      sourceText = currentText;
    }
    if (!sourceText.trim()) {
      return;
    }
    smartInputSources.set(element, sourceText);
    enableSmartInputDisplay(element, sourceText);
    const settings = await chrome.storage.sync.get(['targetWriteLang']);
    const targetLang = settings.targetWriteLang || 'en';
    let finalText: string | null = null;
    try {
      if (typeof Translator !== 'undefined') {
        const detectedSourceLang = await detectLanguageAccurate(sourceText, true);
        const availability = await Translator.availability({
          sourceLanguage: detectedSourceLang,
          targetLanguage: targetLang
        });
        if (availability === 'available') {
          const translator = await Translator.create({
            sourceLanguage: detectedSourceLang,
            targetLanguage: targetLang
          });
          const translatedText = await translator.translate(sourceText);
          if (targetLang === 'zh-Hant') {
            finalText = ensureTraditionalChinese(translatedText);
          } else {
            finalText = translatedText;
          }
        } else if (availability === 'downloadable') {
          console.log(`Translation model for ${targetLang} needs to be downloaded - starting download...`);
          showSmartInputStatus(`Downloading ${targetLang} model...`, 'info', true);
          const downloadingText = `[Translation model downloading for ${targetLang}, please wait...] ${sourceText}`;
          setSmartInputElementValue(element, downloadingText, false);
          let downloadHandled = false;
          try {
            const translator = await Translator.create({
              sourceLanguage: detectedSourceLang,
              targetLanguage: targetLang,
              monitor(m) {
                m.addEventListener('downloadprogress', async (e: ProgressEvent) => {
                  const total = e.total || 0;
                  const loaded = e.loaded || 0;
                  const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                  if (!downloadHandled) {
                    console.log(`Downloaded ${progress}% for ${targetLang}`);
                    showSmartInputStatus(progress > 0 ? `Downloading ${targetLang} model... ${progress}%` : `Downloading ${targetLang} model...`, 'info', true);
                    const progressText = `[Downloading ${progress}% for ${targetLang}] ${sourceText}`;
                    setSmartInputElementValue(element, progressText, false);
                    if (progress >= 100) {
                      downloadHandled = true;
                      console.log(`Download completed for ${targetLang}, starting translation...`);
                      try {
                        const result = await translator.translate(sourceText);
                        console.log(`Translation completed for ${targetLang}: ${sourceText} -> ${result}`);
                        if (targetLang === 'zh-Hant') {
                          setSmartInputElementValue(element, ensureTraditionalChinese(result));
                        } else {
                          setSmartInputElementValue(element, result);
                        }
                        showSmartInputStatus(`Download completed for ${targetLang}`, 'success');
                      } catch (translationError) {
                        console.error('Error during translation after download:', translationError);
                        setSmartInputElementValue(element, `[Translation failed for ${targetLang}] ${sourceText}`, false);
                        showSmartInputStatus(`Translation failed for ${targetLang}`, 'error');
                      }
                    }
                  }
                });
              },
            });
            if (!downloadHandled) {
              downloadHandled = true;
              try {
                const result = await translator.translate(sourceText);
                console.log(`Translation completed for ${targetLang}: ${sourceText} -> ${result}`);
                if (targetLang === 'zh-Hant') {
                  setSmartInputElementValue(element, ensureTraditionalChinese(result));
                } else {
                  setSmartInputElementValue(element, result);
                }
                showSmartInputStatus(`Download completed for ${targetLang}`, 'success');
              } catch (translationError) {
                console.error('Error during translation after download:', translationError);
                setSmartInputElementValue(element, `[Translation failed for ${targetLang}] ${sourceText}`, false);
                showSmartInputStatus(`Translation failed for ${targetLang}`, 'error');
              }
            }
            return `[Translation model downloading for ${targetLang}, please wait...] ${sourceText}`;
          } catch (downloadError: any) {
            console.error('Error starting model download:', downloadError);
            if (downloadError.name === 'NotAllowedError' && downloadError.message.includes('user gesture')) {
              showSmartInputStatus(`Downloading ${targetLang} model...`, 'info', true);
              await new Promise(resolve => setTimeout(resolve, 2000));
              try {
                const recheckAvailability = await Translator.availability({
                  sourceLanguage: detectedSourceLang,
                  targetLanguage: targetLang
                });
                if (recheckAvailability === 'downloadable') {
                  console.log('Download is actually proceeding despite initial error');
                  return `[Translation model downloading for ${targetLang}, please wait...] ${sourceText}`;
                }
              } catch (recheckError) {
                console.log('Could not recheck availability:', recheckError);
              }
              return `[Translation model downloading for ${targetLang}, please wait...] ${sourceText}`;
            }
            showSmartInputStatus(`Download failed for ${targetLang}`, 'error');
            return `[Download failed for ${targetLang}] ${sourceText}`;
          }
        } else {
          console.warn(`Translation not available for target language: ${targetLang}`);
          finalText = `[Translation temporarily unavailable: ${targetLang}] ${sourceText}`;
          showSmartInputStatus(`Translation unavailable for ${targetLang}`, 'error');
        }
      } else {
        console.warn('Translator API not supported — using fallback translation for testing');
        finalText = `[translated:${targetLang}] ${sourceText}`;
      }
      if (finalText !== null) {
        setSmartInputElementValue(element, finalText);
      }
    } catch (error) {
      console.error("Translationbridge Translator Error:", error);
      const errorText = `[Translation error] ${sourceText}`;
      setSmartInputElementValue(element, errorText, false);
      showSmartInputStatus('Translation error. Please try again.', 'error');
    }
  }
});

// Listen for storage changes to auto-update translations when language settings change
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync') {
    const readLangChanged = changes.targetReadLang && changes.targetReadLang.newValue !== changes.targetReadLang.oldValue;
    const writeLangChanged = changes.targetWriteLang && changes.targetWriteLang.newValue !== changes.targetWriteLang.oldValue;

    if (changes.targetReadLang && typeof changes.targetReadLang.newValue === 'string') {
      currentTargetReadLang = changes.targetReadLang.newValue;
    }

    if (readLangChanged || writeLangChanged) {
      console.log('Language settings changed, reverting and re-translating...');

      // Check if page is currently translated
      const translatedElements = document.querySelectorAll('.translationbridge-translated');
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
  } else if (namespace === 'local') {
    if (changes.translationToggleStateByTab || changes.translationToggleState) {
      await syncTabTranslationState(false);
    }
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Content script received message:', message.action, 'from', sender);

  if (message.action === "translatePage") {
    await syncTabTranslationState(false);
    translationQueue = translationQueue
      .then(async () => {
        console.log('Starting page translation...');
        await translatePage();
        console.log('Page translation completed');
      })
      .catch(error => {
        console.error('Queued translation failed:', error);
      });
  } else if (message.action === "revertPage") {
    await syncTabTranslationState(false);
    translationQueue = translationQueue
      .then(() => {
        console.log('Starting page revert...');
        revertPage();
        console.log('Page revert completed');
      })
      .catch(error => {
        console.error('Queued revert failed:', error);
      });
  } else if (message.action === "updateExistingTranslations") {
    translationQueue = translationQueue
      .then(async () => {
        console.log('Updating existing translations...');
        await updateExistingTranslations();
        console.log('Existing translations updated');
      })
      .catch(error => {
        console.error('Queued translation update failed:', error);
      });
  } else if (message.action === "resetTranslationState") {
    console.log('Resetting translation state from popup');
    // This message is sent from content script to itself, no action needed
    sendResponse({ success: true });
    return true;
  } else if (message.action === "getPageTranslationStatus") {
    // Return current page translation status
    const translatedElements = document.querySelectorAll('.translationbridge-translated');
    const translationWrappers = document.querySelectorAll('.translationbridge-translation-wrapper');
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

async function translatePage(options: TranslatePageOptions = {}) {
  mutationSuppressed = true;
  try {
    const showIndicator = options.showIndicator !== false;
    const skipPolling = options.skipPolling === true;
    let targetLang: string;
    if (options.targetLang) {
      targetLang = options.targetLang;
    } else {
      const settings = await chrome.storage.sync.get(['targetReadLang']);
      targetLang = settings.targetReadLang || 'en';
    }
    currentTargetReadLang = targetLang;

    let loadingDiv: HTMLElement | null = null;
    if (showIndicator) {
      loadingDiv = document.getElementById('translationbridge-loading');
      if (loadingDiv) {
        loadingDiv.textContent = 'Translating...';
      } else {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'translationbridge-loading';
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
      }
    }

    if (showIndicator && !skipPolling) {
      pollForPageTranslationCompletion(targetLang);
    }

    const nodes = document.querySelectorAll<HTMLElement>('p, h1, h2, h3, li, blockquote');

    type TranslationTask = {
      element: HTMLElement;
      mode: 'block' | 'inline';
      originalText: string;
    };

    const tasks: TranslationTask[] = [];

    for (const node of nodes) {
      sanitizeTranslationArtifacts(node);
      if (node.classList.contains('translationbridge-translated')) continue;
      if (node.querySelector(':scope > .translationbridge-translation-wrapper')) continue;

      const inlineTargets = getInlineTranslationTargets(node);
      if (inlineTargets.length > 0) {
        inlineTargets.forEach(target => {
          if (target.classList.contains('translationbridge-inline-translated')) {
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
        continue;
      }

      if (node.tagName === 'LI') {
        if (isNavigationContext(node)) {
          continue;
        }
        if (listItemHasBlockContent(node)) {
          continue;
        }
      }

      const textContent = node.textContent?.trim();
      if (!textContent) continue;
      if (textContent.length <= 10) continue;

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

    if (showIndicator) {
      const loadingElement = document.getElementById('translationbridge-loading');
      if (loadingElement) {
        if (downloadPending) {
          loadingElement.textContent = 'Downloading translation model...';
        } else {
          loadingElement.remove();
        }
      }
    }

  } catch (error) {
    console.error('Error in translatePage:', error);

    if (options.showIndicator !== false) {
      const loadingElement = document.getElementById('translationbridge-loading');
      if (loadingElement) {
        loadingElement.remove();
      }

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
  } finally {
    mutationSuppressed = false;
    if (mutationDeferred) {
      mutationDeferred = false;
      if (autoTranslateEnabled) {
        scheduleFullTranslation(200, {
          showIndicator: false,
          skipPolling: true,
          targetLang: currentTargetReadLang,
        });
      }
    }
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

function listItemHasBlockContent(node: HTMLElement): boolean {
  if (node.tagName !== 'LI') {
    return false;
  }
  return node.querySelector('p, h1, h2, h3, h4, h5, h6, blockquote') !== null;
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
  if (!element.dataset.translationbridgeOriginalInline) {
    element.dataset.translationbridgeOriginalInline = getInlineOriginalText(element);
  }

  replaceTextPreservingChildren(element, translatedText);
  element.classList.add('translationbridge-inline-translated');
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
  const existingWrapper = sanitizeTranslationArtifacts(element);
  element.classList.add('translationbridge-translated');
  if (existingWrapper) {
    const translationContent = existingWrapper.querySelector('font.translationbridge-translation-content');
    if (translationContent) {
      translationContent.textContent = translatedText;
    }
    return;
  }

  if (!element.dataset.translationbridgeOriginal) {
    element.dataset.translationbridgeOriginal = element.textContent || '';
  }

  if (shouldInsertLineBreak(element)) {
    const lineBreak = document.createElement('br');
    lineBreak.dataset.translationbridgeInjected = 'line-break';
    element.appendChild(lineBreak);
  }

  const translationWrapper = document.createElement('span');
  translationWrapper.className = 'translationbridge-translation-wrapper';
  translationWrapper.dataset.translationbridgeInjected = 'translation';

  const translationContentFont = document.createElement('font');
  translationContentFont.className = 'translationbridge-translation-content';
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

function sanitizeTranslationArtifacts(element: HTMLElement): HTMLElement | null {
  const wrappers = Array.from(element.querySelectorAll<HTMLElement>(':scope > .translationbridge-translation-wrapper'));
  wrappers.forEach((wrapperNode, index) => {
    if (index > 0) {
      wrapperNode.remove();
    }
  });
  const primaryWrapper = wrappers[0] && wrappers[0].isConnected ? wrappers[0] : null;
  const lineBreaks = Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-translationbridge-injected="line-break"]'));
  lineBreaks.forEach((lineBreakNode, index) => {
    if (index > 0) {
      lineBreakNode.remove();
    }
  });
  const firstLineBreak = lineBreaks[0] && lineBreaks[0].isConnected ? lineBreaks[0] : null;
  if (firstLineBreak && primaryWrapper && firstLineBreak.nextSibling !== primaryWrapper) {
    element.insertBefore(firstLineBreak, primaryWrapper);
  }
  if (primaryWrapper && primaryWrapper.dataset.translationbridgeInjected !== 'translation') {
    primaryWrapper.dataset.translationbridgeInjected = 'translation';
  }
  return primaryWrapper;
}

function revertPage() {
  try {
    // Find all translated elements and restore their original text
    const translatedElements = document.querySelectorAll<HTMLElement>('.translationbridge-translated');
    translatedElements.forEach(element => {
      try {
        const wrappers = element.querySelectorAll(':scope > .translationbridge-translation-wrapper');
        wrappers.forEach(wrapperNode => {
          const wrapper = wrapperNode as HTMLElement;
          const previousSibling = wrapper.previousSibling;
          if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE) {
            const previousElement = previousSibling as HTMLElement;
            if (
              previousElement.dataset.translationbridgeInjected === 'line-break' ||
              previousElement.tagName === 'BR'
            ) {
              previousElement.remove();
            }
          }
          wrapper.remove();
        });

        const injectedLineBreaks = element.querySelectorAll(':scope > [data-translationbridge-injected="line-break"]');
        injectedLineBreaks.forEach(lineBreak => lineBreak.remove());

        element.classList.remove('translationbridge-translated');
        delete element.dataset.translationbridgeOriginal;
      } catch (error) {
        console.error('Error reverting element:', error);
      }
    });

    const inlineTranslatedElements = document.querySelectorAll<HTMLElement>('.translationbridge-inline-translated');
    inlineTranslatedElements.forEach(element => {
      try {
        const originalText = element.dataset.translationbridgeOriginalInline;
        if (originalText !== undefined) {
          replaceTextPreservingChildren(element, originalText);
          delete element.dataset.translationbridgeOriginalInline;
        }
        element.classList.remove('translationbridge-inline-translated');
      } catch (error) {
        console.error('Error reverting inline element:', error);
      }
    });

    // Handle legacy containers (for backward compatibility)
    const containers = document.querySelectorAll('.translationbridge-bilingual-container, .translationbridge-vertical-container');
    containers.forEach(container => {
      try {
        const originalNode = container.querySelector('.translationbridge-original');
        if (originalNode && container.parentNode) {
          container.parentNode.replaceChild(originalNode, container);
        }
      } catch (error) {
        console.error('Error reverting legacy container:', error);
      }
    });

    // Also remove any loading indicators that might be left over
    const loadingElement = document.getElementById('translationbridge-loading');
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
    const detectedSourceLang = await detectLanguageAccurate(text);

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
function heuristicLanguageDetection(text: string): string {
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

  // First, collect all source languages from the page using accurate detection
  const nodes = document.querySelectorAll<HTMLElement>('p, h1, h2, h3, li, blockquote');
  for (const node of nodes) {
    sanitizeTranslationArtifacts(node);
    if (node.classList.contains('translationbridge-translated')) continue;
    if (node.querySelector(':scope > .translationbridge-translation-wrapper')) continue;

    const textContent = node.textContent?.trim();
    if (textContent && textContent.length > 10) {
      const sourceLang = await detectLanguageAccurate(textContent);
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
        const loadingElement = document.getElementById('translationbridge-loading');
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
        const loadingElement = document.getElementById('translationbridge-loading');
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
      if (node.classList.contains('translationbridge-translated')) continue;
      if (node.querySelector(':scope > .translationbridge-translation-wrapper')) continue;

      const inlineTargets = getInlineTranslationTargets(node);
      if (inlineTargets.length > 0) {
        inlineTargets.forEach(target => {
          if (target.classList.contains('translationbridge-inline-translated')) {
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

      if (node.tagName === 'LI') {
        if (isNavigationContext(node)) {
          // Complex navigation list-items get handled via inline targets or skipped to avoid layout breaks
          continue;
        }
        if (listItemHasBlockContent(node)) {
          continue;
        }
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
    const loadingElement = document.getElementById('translationbridge-loading');
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
    const loadingElement = document.getElementById('translationbridge-loading');
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
        const targetElement = activeElement && isSmartInputElement(activeElement) ? activeElement : null;
        if (targetElement) {
          smartInputSources.set(targetElement, originalText);
          updateSmartInputDisplay(targetElement, originalText);
          setSmartInputElementValue(targetElement, finalText);
        }

        console.log(`Translation completed for ${targetLang}: ${originalText} -> ${finalText}`);
      } else if (availability === 'unavailable') {
        console.log(`Translation model for ${targetLang} became unavailable`);
        clearInterval(pollInterval);

        // Update UI to show error
        const targetElement = activeElement && isSmartInputElement(activeElement) ? activeElement : null;
        if (targetElement) {
          smartInputSources.set(targetElement, originalText);
          updateSmartInputDisplay(targetElement, originalText);
          setSmartInputElementValue(targetElement, `[Translation unavailable for ${targetLang}] ${originalText}`, false);
        }
      } else if (attempts >= maxAttempts) {
        console.log(`Polling timeout for ${targetLang} - stopping after ${maxAttempts} attempts`);
        clearInterval(pollInterval);

        // Update UI to show timeout
        const targetElement = activeElement && isSmartInputElement(activeElement) ? activeElement : null;
        if (targetElement) {
          smartInputSources.set(targetElement, originalText);
          updateSmartInputDisplay(targetElement, originalText);
          setSmartInputElementValue(targetElement, `[Translation timeout for ${targetLang}] ${originalText}`, false);
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
    const translatedElements = document.querySelectorAll<HTMLElement>('.translationbridge-translated');
    for (const element of translatedElements) {
      sanitizeTranslationArtifacts(element);
      const originalText = element.dataset.translationbridgeOriginal;
      if (originalText) {
        try {
          const translatedText = await translateText(originalText, newTargetLang);
          if (translatedText && !translatedText.startsWith('[')) {
            // Update the translation content
            const existingWrapper = element.querySelector(':scope > .translationbridge-translation-wrapper');
            if (existingWrapper) {
              const translationContent = existingWrapper.querySelector('font.translationbridge-translation-content');
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
    const inlineTranslatedElements = document.querySelectorAll<HTMLElement>('.translationbridge-inline-translated');
    for (const element of inlineTranslatedElements) {
      const originalText = element.dataset.translationbridgeOriginalInline;
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

  var LanguageDetector: {
    create(options?: {
      monitor?: (m: any) => void;
    }): Promise<LanguageDetectorInstance>;
  };

  interface TranslatorInstance {
    translate(text: string): Promise<string>;
    translateStreaming(text: string): AsyncIterable<string>;
  }
}
