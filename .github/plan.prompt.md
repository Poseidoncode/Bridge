# TranslationGummy Chrome Extension Development Plan

Your task is to develop a Chrome extension named "TranslationGummy" that provides an immersive web communication experience, combining full-page translation reading with seamless native language input and writing.

Follow the phases and steps strictly. Wait for the next instruction after each step completion.

## Phase 0: Knowledge Acquisition

### Instruction 0.1:
Before coding, locate and thoroughly learn core concepts from the following documents in the CONTEXT7 knowledge base. This is a prerequisite for success.

**Document List:**

1. **Chrome Extension - Manifest V3 Developer Documentation**
   - Keywords: `Manifest V3`, `Chrome Extension manifest.json`, `Content Scripts`, `Message Passing`, `chrome.action API`, `chrome.storage API`
   - Concepts to master:
     - Role of `content_scripts`, matching patterns (`matches`), and execution environment isolation.
     - Message passing between `action` (Popup) and Content Script (`chrome.runtime.sendMessage`, `chrome.runtime.onMessage`).
     - Using `chrome.storage.sync` for cross-device settings persistence.
     - MV3 permission model (`permissions` and `host_permissions`).

2. **Chrome for Developers - Built-in AI APIs Documentation**
   - Keywords: `chrome.ai`, `On-Device AI`, `createTextTranslator`, `createWriter`
   - Concepts to master:
     - Checking `chrome.ai.canCreate*` to confirm model availability.
     - Asynchronous usage of `createTextTranslator().translate()`.
     - Prompt design principles for `createWriter()` to achieve natural language conversion.
     - Asynchronous nature of APIs, must use `async/await`.

3. **Svelte 5 Documentation**
   - Keywords: `Svelte 5`, `Svelte Runes`, `$state`, `$effect`, `Svelte components`
   - Concepts to master:
     - Creating a basic Svelte component.
     - Using `$state` for reactive state management.
     - Handling logic in `<script>` tags and rendering UI in HTML templates.

4. **Vite Official Documentation**
   - Keywords: `Vite`, `Vite project setup`, `vite.config.js`
   - Concepts to master:
     - Using `npm create vite@latest` to initialize a Svelte + TypeScript project.
     - Basic principles of Vite as a dev server and build tool.

### Instruction 0.2:
Confirm the above documents are learned and ready to proceed with development.

## Phase 1: Project Environment Initialization

### Instruction 1.1:
In your working directory, run the following shell commands to create a Vite project with Svelte 5 and TypeScript.

```bash
npm create vite@latest translationgummy-extension -- --template svelte-ts
cd translationgummy-extension
npm install
```

### Instruction 1.2:
Install the Vite plugin for Chrome extension development.

```bash
npm install @crxjs/vite-plugin@latest --save-dev
```

### Instruction 1.3:
Create `vite.config.ts` in the project root. Replace existing content with the following to integrate CRXJS plugin.

```typescript
// File: vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    svelte(),
    crx({ manifest }),
  ],
})
```

## Phase 2: Manifest V3 Configuration

### Instruction 2.1:
Create `manifest.json` in the project root. This is the core definition of the extension. Fill with the following content.

```json
// File: manifest.json
{
  "manifest_version": 3,
  "name": "TranslationGummy - Immersive Communicator",
  "version": "1.0.0",
  "description": "Provides a privacy-first, on-device AI-powered immersive reading and writing experience.",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content.ts"]
    }
  ],
  "background": {
    "service_worker": "src/background.ts"
  }
}
```

### Instruction 2.2:
Create an `icons` folder in the project root and place three PNG icons: `icon16.png`, `icon48.png`, `icon128.png`. If no icons available, create placeholder files.

### Instruction 2.3:
In the `src` folder, create two empty files: `content.ts` and `background.ts`.

## Phase 3: Implement "Seamless Writing Mode" MVP

### Instruction 3.1:
Open `src/content.ts`. Implement core writing translation logic. This script injects into all web pages. Fill with the following code:

```typescript
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

    // TODO: Get target language from chrome.storage
    const targetLang = 'en'; // MVP stage, hardcoded to English

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
```

## Phase 4: Implement Popup Controller UI

### Instruction 4.1:
Rename `src/App.svelte` to `Popup.svelte`. This will be our popup UI. Replace its content with the following:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  // Using Svelte 5 Runes
  let readingEnabled = $state(false);
  let targetWriteLang = $state('en');
  let targetReadLang = $state('zh-TW');

  // On component mount, load settings from chrome.storage
  onMount(async () => {
    const result = await chrome.storage.sync.get(['readingEnabled', 'targetWriteLang', 'targetReadLang']);
    readingEnabled = result.readingEnabled ?? false;
    targetWriteLang = result.targetWriteLang ?? 'en';
    targetReadLang = result.targetReadLang ?? 'zh-TW';
  });

  // When toggle changes, save settings and notify Content Script
  function handleToggleChange() {
    chrome.storage.sync.set({ readingEnabled });
    // Notify current tab's Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: readingEnabled ? "translatePage" : "revertPage"
        });
      }
    });
  }

  // Auto-save language settings on change
  $effect(() => {
    chrome.storage.sync.set({ targetWriteLang, targetReadLang });
  });

</script>

<main>
  <h1>TranslationGummy</h1>
  <div class="setting-row">
    <label for="reading-toggle">Enable Immersive Reading</label>
    <input type="checkbox" id="reading-toggle" bind:checked={readingEnabled} on:change={handleToggleChange} />
  </div>
  <div class="setting-row">
    <label for="write-lang">Writing Target Language</label>
    <select id="write-lang" bind:value={targetWriteLang}>
      <option value="en">English</option>
      <option value="ja">Japanese</option>
      <option value="ko">Korean</option>
    </select>
  </div>
  <div class="setting-row">
    <label for="read-lang">Reading Target Language</label>
    <select id="read-lang" bind:value={targetReadLang}>
      <option value="zh-TW">Traditional Chinese</option>
      <option value="zh-CN">Simplified Chinese</option>
    </select>
  </div>
</main>

<style>
  main {
    width: 250px;
    padding: 10px;
    font-family: sans-serif;
  }
  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
  }
  label {
    font-size: 14px;
  }
  select, input {
    font-size: 14px;
  }
</style>
```

### Instruction 4.2:
Modify `src/main.ts` to mount `Popup.svelte`.

```typescript
// File: src/main.ts
import './app.css'
import Popup from './Popup.svelte'

const app = new Popup({
  target: document.getElementById('app'),
})

export default app
```

### Instruction 4.3:
Modify root `index.html` as the popup carrier.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TranslationGummy Popup</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## Phase 5: Implement "Immersive Reading Mode" MVP

### Instruction 5.1:
Return to `src/content.ts`. Append message listener logic from Popup and implement page translation and revert.

```typescript
// File: src/content.ts (Append to the end)

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
      const translatedNode = document.createElement('p');
      translatedNode.className = 'translationgummy-translation';
      translatedNode.textContent = translatedText;
      (node as HTMLElement).style.marginBottom = '0.25em';
      node.after(translatedNode);
    }
  });
}

function revertPage() {
  const translatedNodes = document.querySelectorAll('.translationgummy-translation');
  translatedNodes.forEach(node => node.remove());
  document.querySelectorAll('p, h1, h2, h3, li, blockquote').forEach(node => {
      (node as HTMLElement).style.marginBottom = '';
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
```

### Instruction 5.2:
Create `src/content.css` for styling injected translation text.

```css
/* File: src/content.css */
.translationgummy-translation {
  color: #555;
  font-size: 0.95em;
  background-color: #f9f9f9;
  border-left: 3px solid #ccc;
  padding: 0.5em;
  margin-top: 0.25em !important;
  margin-bottom: 1em !important;
}
```

### Instruction 5.3:
Modify `manifest.json` to inject `content.css` into pages.

```json
// In manifest.json, modify "content_scripts":
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["src/content.ts"],
    "css": ["src/content.css"]
  }
],
```

## Phase 6: Build and Test

### Instruction 6.1:
Run the following command to build the extension.

```bash
npm run build
```

### Instruction 6.2:
Provide the following steps to for testing:

1. Open Chrome browser, go to `chrome://extensions`.
2. Enable "Developer mode" in the top right.
3. Click "Load unpacked".
4. Select the `dist` folder in your project.
5. "TranslationGummy" extension should now be installed.
6. **Test Writing**: Go to any site (e.g., Google Search), type Chinese in an input box, then press `Shift+Enter`. Text should translate to English.
7. **Test Reading**: Go to an English site (e.g., BBC News), click the TranslationGummy icon in top right, toggle "Enable Immersive Reading". Translated Chinese should appear below paragraphs.

**Agent, your task is fully defined. Start execution from Phase 1.**