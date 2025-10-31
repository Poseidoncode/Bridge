## &#10022; Software Introduction

For years, the promise of a truly global internet has been fractured by the invisible wall of language. We browse to its edges, only to find vibrant conversations rendered incomprehensible. A new browser extension, “Bridge,” aims not just to lower that wall, but to make it dissolve entirely.

Bridge operates on a powerful two-way principle. Its immersive reading mode transforms any webpage into a dual-language view, placing accurate translations alongside the original text. This allows for nuanced understanding without losing context. More importantly, it empowers users to participate. Within any text box, one can type in their native tongue, and with a simple shortcut, Bridge instantly converts their thoughts into fluent, natural-sounding prose in the target language, eliminating the friction of traditional translation.

What truly sets Bridge apart is its architecture. Unlike services that process data in the cloud, it leverages Chrome’s built-in, on-device AI. The implications are profound: absolute user privacy, as data never leaves the machine; instantaneous speed free from network latency; and full offline functionality.

This isn't just another translation tool; it's a new paradigm for web interaction. Bridge is designed not merely to translate content, but to foster genuine dialogue, giving everyone the confidence to step across the linguistic divide and join the global conversation.

## Installation

To install the Bridge browser extension, follow these steps:

### Prerequisites

- Node.js (version 22.14 or higher)
- npm (comes with Node.js)
- Google Chrome browser

### Steps

1. **Clone or download the repository:**

   ```
   git clone https://github.com/Poseidoncode/Bridge.git
   cd Bridge
   ```

2. **Navigate to the extension directory:**

   ```
   cd translationgummy-extension
   ```

3. **Install dependencies:**

   ```
   npm install
   ```

4. **Build the extension:**

   ```
   cd translationgummy-extension
   npm run build
   ```

5. **Load the extension in Chrome:**
   - Open Google Chrome.
   - Go to `chrome://extensions/`.
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked" and select the `dist` folder inside the `translationgummy-extension` directory.

The Bridge extension should now be installed and ready to use. You can access it from the extensions menu in Chrome.
