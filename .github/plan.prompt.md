# TranslationGummy Chrome Extension Development Plan

## 🎯 Project Overview

**TranslationGummy** is a revolutionary Chrome extension that eliminates web language barriers through a **complete, secure, and seamless cross-language communication ecosystem**.

### Core Features

1. **📰 Immersive Reading Mode**: Transforms foreign webpages into bilingual interfaces with side-by-side original/translated content
2. **✍️ Seamless Writing Mode**: Real-time native language input with `Shift+Enter` translation to target languages
3. **🔒 Privacy-First Architecture**: On-device AI processing ensures absolute privacy and offline capability

### Technical Innovation

- **Chrome Built-in AI APIs**: Leveraging `Translator` API for instant, private translations
- **Progressive Enhancement**: Graceful degradation when AI features unavailable
- **Cross-Platform Sync**: Settings synchronization across devices via `chrome.storage.sync`

---

## 📋 Development Roadmap

**To AI Agent:**

Execute this comprehensive development plan systematically. Each phase includes detailed instructions, technical considerations, and success criteria.

### ✅ Prerequisites & Risk Assessment

**Technical Dependencies:**

- Chrome Manifest V3 compatibility
- Chrome Built-in AI Translator API availability (`Translator.availability()`, `Translator.create()`)
- Svelte 5 + TypeScript + Vite build pipeline
- CRXJS for Chrome extension packaging

**Potential Risks & Mitigations:**

- ⚠️ **AI API Limitations**: Implement fallback mechanisms and user notifications
- ⚠️ **Performance Impact**: Add throttling and caching layers
- ⚠️ **DOM Manipulation Conflicts**: Use non-destructive overlay techniques
- ⚠️ **Memory Leaks**: Implement proper cleanup in content scripts
- ⚠️ **Cross-Site Compatibility**: Test across major websites and handle edge cases

**Success Metrics:**

- ✅ Extension loads without console errors
- ✅ Translation accuracy > 90% for supported languages
- ✅ Response time < 2s for typical translations
- ✅ Memory usage stable during extended use
- ✅ Settings persist across browser sessions

## Phase 0: Knowledge Acquisition

### Instruction 0.1:

Before coding, locate and thoroughly learn core concepts from the following documents in the CONTEXT7 knowledge base. This is a prerequisite for success.

**⚠️ Important: Use CONTEXT7 MCP Server for Document Access**

All documentation reading and research must be conducted using the **context7 MCP server**:

```bash
# Ensure context7 MCP server is running
npx context7-mcp@latest

# Use access_mcp_resource tool to read documentation
access_mcp_resource("context7", "docs://chrome-extension-manifest-v3")
access_mcp_resource("context7", "docs://chrome-built-in-ai")
access_mcp_resource("context7", "docs://svelte-5")
access_mcp_resource("context7", "docs://vite")
```

**Document List:**

1. **Chrome Extension - Manifest V3 Developer Documentation**

   - **MCP Resource**: `docs://chrome-extension-manifest-v3`
   - Keywords: `Manifest V3`, `Chrome Extension manifest.json`, `Content Scripts`, `Message Passing`, `chrome.action API`, `chrome.storage API`
   - Concepts to master:
     - Role of `content_scripts`, matching patterns (`matches`), and execution environment isolation.
     - Message passing between `action` (Popup) and Content Script (`chrome.runtime.sendMessage`, `chrome.runtime.onMessage`).
     - Using `chrome.storage.sync` for cross-device settings persistence.
     - MV3 permission model (`permissions` and `host_permissions`).

2. **Chrome for Developers - Built-in AI APIs Documentation**

   - **MCP Resource**: `docs://chrome-built-in-ai`
   - Keywords: `Translator API`, `On-Device AI`, `Translator.availability()`, `Translator.create()`
   - Concepts to master:
     - Checking `Translator.availability()` to confirm model availability.
     - Asynchronous usage of `Translator.create().translate()`.
     - Language pair support and automatic language detection.
     - Asynchronous nature of APIs, must use `async/await`.

3. **Svelte 5 Documentation**

   - **MCP Resource**: `docs://svelte-5`
   - Keywords: `Svelte 5`, `Svelte Runes`, `$state`, `$effect`, `Svelte components`
   - Concepts to master:
     - Creating a basic Svelte component.
     - Using `$state` for reactive state management.
     - Handling logic in `<script>` tags and rendering UI in HTML templates.

4. **Vite Official Documentation**
   - **MCP Resource**: `docs://vite`
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
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [svelte(), crx({ manifest })],
});
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
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
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
document.addEventListener("focusin", (event) => {
  const target = event.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    activeElement = target as HTMLInputElement | HTMLTextAreaElement;
  }
});

// Listen for keyboard events, trigger translation on Shift+Enter
document.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && event.shiftKey && activeElement) {
    event.preventDefault(); // Prevent default newline behavior

    const originalText = activeElement.isContentEditable
      ? activeElement.innerText
      : activeElement.value;
    if (!originalText) return;

    // Get target language from chrome.storage
    const settings = await chrome.storage.sync.get(["targetWriteLang"]);
    const targetLang = settings.targetWriteLang || "en"; // Default to English if not set

    try {
      // Check if Translator API is available
      if (typeof Translator !== "undefined") {
        // Check if translation is available for the language pair
        const availability = await Translator.availability({
          sourceLanguage: "auto", // Use 'auto' to detect source language automatically
          targetLanguage: targetLang,
        });

        if (availability === "available") {
          // Create translator instance
          const translator = await Translator.create({
            sourceLanguage: "auto",
            targetLanguage: targetLang,
          });

          // Perform translation
          const translatedText = await translator.translate(originalText);

          if (activeElement.isContentEditable) {
            activeElement.innerText = translatedText;
          } else {
            activeElement.value = translatedText;
          }
        } else if (availability === "downloadable") {
          console.log(
            `Translation model for ${targetLang} needs to be downloaded`
          );
        } else {
          console.warn(
            `Translation not available for target language: ${targetLang}`
          );
        }
      } else {
        // Fallback for browsers that don't support Translator API yet
        console.warn(
          "Translator API not supported — using fallback translation for testing"
        );
      }
    } catch (error) {
      console.error("TranslationGummy Translator Error:", error);
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
  let targetReadLang = $state('zh-Hant');

  // On component mount, load settings from chrome.storage
  onMount(async () => {
    const result = await chrome.storage.sync.get(['readingEnabled', 'targetWriteLang', 'targetReadLang']);
    readingEnabled = result.readingEnabled ?? false;
    targetWriteLang = result.targetWriteLang ?? 'en';
    targetReadLang = result.targetReadLang ?? 'zh-Hant';
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
      <option value="zh-Hant">Traditional Chinese</option>
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
import "./app.css";
import Popup from "./Popup.svelte";

const app = new Popup({
  target: document.getElementById("app"),
});

export default app;
```

### Instruction 4.3:

Modify root `index.html` as the popup carrier.

```html
<!DOCTYPE html>
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

**Note:** The translation results should be presented in a bilingual comparison format, where the original text remains visible alongside the translated text for easy reference and comparison.

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
  const settings = await chrome.storage.sync.get(["targetReadLang"]);
  const targetLang = settings.targetReadLang || "zh-Hant";

  const nodes = document.querySelectorAll("p, h1, h2, h3, li, blockquote");
  const translationPromises = [];
  const originalNodes = [];

  for (const node of nodes) {
    if (node.textContent && node.textContent.trim().length > 10) {
      // Only translate texts with sufficient length
      originalNodes.push(node);
      translationPromises.push(translateText(node.textContent, targetLang));
    }
  }

  const translatedTexts = await Promise.all(translationPromises);

  originalNodes.forEach((node, index) => {
    const translatedText = translatedTexts[index];
    if (translatedText) {
      // Create a container for bilingual display
      const container = document.createElement("div");
      container.className = "translationgummy-bilingual-container";

      // Clone the original node and wrap it
      const originalClone = node.cloneNode(true) as HTMLElement;
      originalClone.className = "translationgummy-original";

      // Create translated node
      const translatedNode = document.createElement("div");
      translatedNode.className = "translationgummy-translation";
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
  const containers = document.querySelectorAll(
    ".translationgummy-bilingual-container"
  );
  containers.forEach((container) => {
    const originalNode = container.querySelector(".translationgummy-original");
    if (originalNode) {
      container.parentNode?.replaceChild(originalNode, container);
    }
  });
}

async function translateText(
  text: string,
  targetLang: string
): Promise<string | null> {
  try {
    // Check if Translator API is supported
    if (typeof Translator === "undefined") {
      console.warn("Translator API not supported");
      return null;
    }

    // Check if translation is available for the language pair
    const availability = await Translator.availability({
      sourceLanguage: "auto", // Use 'auto' to detect source language automatically
      targetLanguage: targetLang,
    });

    if (availability !== "available") {
      console.warn(
        `Translation not available for target language: ${targetLang}`
      );
      return null;
    }

    // Create translator instance
    const translator = await Translator.create({
      sourceLanguage: "auto",
      targetLanguage: targetLang,
    });

    // Perform translation
    const result = await translator.translate(text);
    return result;
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
.translationgummy-bilingual-container {
  display: flex;
  gap: 1em;
  align-items: flex-start;
  margin-bottom: 1em;
}

.translationgummy-original {
  flex: 1;
  padding: 0.5em;
  background-color: #f0f0f0;
  border-radius: 4px;
}

.translationgummy-translation {
  flex: 1;
  color: #555;
  font-size: 0.95em;
  background-color: #f9f9f9;
  border-left: 3px solid #ccc;
  padding: 0.5em;
  border-radius: 4px;
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

Provide the following steps for testing:

**⚠️ Automated Testing with Chrome DevTools MCP:**

```bash
# 1. Launch Chrome and navigate to extensions page
browser_action("launch", "chrome://extensions")

# 2. Enable Developer Mode
browser_action("click", "developer-mode-toggle")

# 3. Load unpacked extension
browser_action("click", "load-unpacked-button")
# Select the dist folder when file dialog appears

# 4. Verify extension is loaded
browser_action("wait_for", "TranslationGummy")
```

**Manual Testing Steps:**

1. **Load Extension**:

   - Open Chrome browser, go to `chrome://extensions`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `dist` folder in your project
   - "TranslationGummy" extension should now be installed

2. **Test Writing Mode**:

   - Go to any site (e.g., Google Search)
   - Type in your native language (e.g., Chinese) in an input box
   - Press `Shift+Enter` to trigger translation
   - The text should be translated into the target language set in the popup (default English)

3. **Test Reading Mode**:

   - Go to an English site (e.g., BBC News)
   - Click the TranslationGummy icon in top right
   - Toggle "Enable Immersive Reading"
   - The page should display bilingual comparison format with original English text and translated Chinese text side by side

4. **Advanced Testing**:

   ```bash
   # Test extension popup functionality
   browser_action("click", "translationgummy-extension-icon")
   browser_action("wait_for", "translationgummy-popup")

   # Test language switching
   browser_action("select_option", "write-lang-dropdown", "ja")
   browser_action("select_option", "read-lang-dropdown", "zh-CN")

   # Test error handling
   browser_action("evaluate", "Translator = undefined")
   # Verify graceful error handling
   ```

---

## 🏗️ Advanced Architecture & Optimizations

### Performance Optimizations

```typescript
// Translation Throttling System
class TranslationThrottler {
  private pendingRequests = new Map<string, Promise<string>>();
  private requestQueue: Array<{ id: string; text: string; resolve: Function }> =
    [];

  async translateWithThrottling(text: string, lang: string): Promise<string> {
    const requestId = `${text}:${lang}`;

    // Return pending request if exists
    if (this.pendingRequests.has(requestId)) {
      return this.pendingRequests.get(requestId)!;
    }

    // Create new translation promise
    const promise = this.performTranslation(text, lang);
    this.pendingRequests.set(requestId, promise);

    promise.finally(() => {
      this.pendingRequests.delete(requestId);
    });

    return promise;
  }
}
```

### Smart Caching Strategy

```typescript
// Multi-layer Caching System
class TranslationCache {
  private memoryCache = new Map<string, CacheEntry>();
  private storageCache = new Map<string, CacheEntry>();

  async get(text: string, lang: string): Promise<string | null> {
    const key = this.generateKey(text, lang);

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      return memoryEntry.translation;
    }

    // Check storage cache
    const storageEntry = await this.getFromStorage(key);
    if (storageEntry && this.isValid(storageEntry)) {
      this.memoryCache.set(key, storageEntry);
      return storageEntry.translation;
    }

    return null;
  }
}
```

### Enhanced Error Handling

```typescript
// Comprehensive Error Management
class ErrorHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, i))
        );
      }
    }
    throw new Error("Max retries exceeded");
  }
}
```

---

## 🧪 Testing Strategy

### ⚠️ Important: Use Chrome DevTools MCP Server for Testing

All testing procedures must utilize the **Chrome DevTools MCP server** for comprehensive browser automation and testing:

```bash
# Install and start Chrome DevTools MCP server
npm install -g chrome-devtools-mcp@latest
npx chrome-devtools-mcp@latest

# Use browser_action tool for testing procedures
browser_action("launch", "chrome://extensions")
browser_action("click", "developer-mode-toggle")
browser_action("click", "load-unpacked-button")
```

### Unit Testing Setup

```bash
# Install testing dependencies
npm install --save-dev vitest @testing-library/svelte @testing-library/jest-dom jsdom

# Add test script to package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### Test Categories

1. **🔧 Unit Tests**: Translation logic, cache management, error handling
2. **🎨 Component Tests**: Popup UI interactions, state management
3. **🌐 Integration Tests**: Chrome APIs, message passing, storage
4. **🚀 E2E Tests**: Full user workflows, cross-browser compatibility (using Chrome DevTools MCP)

### Quality Gates

- ✅ Code coverage > 85%
- ✅ All tests passing in CI/CD
- ✅ No console errors in production build
- ✅ Performance benchmarks met

---

## 📦 Deployment & Distribution

### Build Optimization

```typescript
// vite.config.ts - Production optimizations
export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
    crx({ manifest }),
    mode === "production" && terser(), // Minify for production
  ],
  build: {
    minify: mode === "production" ? "terser" : false,
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["svelte", "svelte/internal"],
        },
      },
    },
  },
}));
```

### Publishing Workflow

1. **🔍 Code Review**: All changes reviewed before merge
2. **✅ Automated Testing**: CI/CD pipeline validates build
3. **📦 Build Creation**: Generate optimized production build
4. **🧪 Manual Testing**: Test across different Chrome versions
5. **📤 Chrome Web Store**: Upload to developer dashboard
6. **📊 Version Management**: Semantic versioning for releases

---

## 🔧 Maintenance & Monitoring

### Update Strategy

- **🔄 Auto-Updates**: Users receive updates automatically via Chrome Web Store
- **⚠️ Breaking Changes**: Major version bumps for API changes
- **🔒 Backward Compatibility**: Maintain compatibility with recent versions

### Monitoring & Analytics

```typescript
// Privacy-focused analytics
class Analytics {
  static track(event: string, data?: Record<string, any>) {
    // Only track non-sensitive events
    if (this.isPrivacySafe(event, data)) {
      chrome.storage.local.set({
        analytics: {
          lastEvent: event,
          timestamp: Date.now(),
          // No personal data stored
        },
      });
    }
  }
}
```

### Support & Troubleshooting

- **📚 Documentation**: Comprehensive user guide and API docs
- **🐛 Issue Tracking**: GitHub issues for bug reports and features
- **💬 User Support**: Clear error messages and help tooltips
- **🔍 Debug Mode**: Developer tools for advanced troubleshooting

---

## 🚨 Risk Mitigation

### Fallback Strategies

1. **AI Unavailable**: Graceful degradation with user notification
2. **Network Issues**: Offline translation queue with sync capability
3. **Performance**: Progressive loading and user-controlled settings
4. **Compatibility**: Feature detection and polyfill strategies

### Security Considerations

- **🔐 Content Security**: Validate all translated content
- **🛡️ Input Sanitization**: Prevent XSS in translation inputs
- **🔒 Data Protection**: No storage of sensitive user content
- **🚫 Abuse Prevention**: Rate limiting and usage monitoring

---

## 📈 Future Enhancements

### Phase 7: Advanced Features (Post-MVP)

1. **🎯 Smart Language Detection**: Auto-detect source/target languages
2. **🌐 Multi-Language Support**: Expand to 50+ languages
3. **📱 Mobile Optimization**: Responsive design for mobile browsers
4. **☁️ Cloud Sync**: Cross-device translation history
5. **🎨 Customization**: Themes, fonts, and layout options

### Phase 8: AI Enhancements

1. **🧠 Context Awareness**: Domain-specific translation models
2. **📝 Writing Assistance**: Grammar and style suggestions
3. **🔊 Audio Support**: Text-to-speech for translated content
4. **🖼️ Visual Translation**: OCR for images and screenshots

---

## ✅ Success Criteria & Validation

### Launch Readiness Checklist

- [ ] All core features implemented and tested
- [ ] Performance benchmarks achieved (< 2s response time)
- [ ] Cross-browser compatibility verified
- [ ] Security audit completed
- [ ] User documentation published
- [ ] Chrome Web Store assets prepared
- [ ] Beta testing feedback incorporated

### Post-Launch Metrics

- 📊 Daily Active Users > 1,000
- ⭐ Average Rating > 4.5 stars
- 🔄 Retention Rate > 70% after 7 days
- 🚀 Translation Success Rate > 95%
- 💬 User Satisfaction Score > 8/10

---

**Agent, your task is fully defined. Start execution from Phase 1.**
