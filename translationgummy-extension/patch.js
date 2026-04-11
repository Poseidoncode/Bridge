const fs = require('fs');
const content = fs.readFileSync('src/content.ts', 'utf-8');
const replacement = `
// IntersectionObserver state
let visibilityObserver: IntersectionObserver | null = null;

function cleanupVisibilityObserver() {
  if (visibilityObserver) {
    visibilityObserver.disconnect();
    visibilityObserver = null;
  }
}
`;

fs.writeFileSync('src/content.ts', content.replace('let languageDetectorBlocked = false;', 'let languageDetectorBlocked = false;\n' + replacement));
