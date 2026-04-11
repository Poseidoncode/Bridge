const fs = require('fs');
let content = fs.readFileSync('src/content.ts', 'utf-8');

const observerVars = `let languageDetectorBlocked = false;

// IntersectionObserver state
let visibilityObserver: IntersectionObserver | null = null;

function cleanupVisibilityObserver() {
  if (visibilityObserver) {
    visibilityObserver.disconnect();
    visibilityObserver = null;
  }
}
`;
content = content.replace('let languageDetectorBlocked = false;', observerVars);

const translatePagePattern = /async function translatePage\(options: TranslatePageOptions = \{\}\) \{[\s\S]*?(?=function isNavigationContext)/;
const match = content.match(translatePagePattern);

if (!match) {
  console.log("Could not find translatePage");
  process.exit(1);
}

let translatePageContent = match[0];

const prioritizeLogic = `    const tasks: TranslationTask[] = [];
    const visibleTasks: TranslationTask[] = [];
    const deferredTasks: TranslationTask[] = [];

    for (const node of nodes) {
      sanitizeTranslationArtifacts(node);
      if (node.classList.contains('translationbridge-translated')) continue;
      if (node.querySelector(':scope > .translationbridge-translation-wrapper')) continue;

      const inlineTargets = getInlineTranslationTargets(node);
      if (inlineTargets.length > 0) {
        inlineTargets.forEach(target => {
          if (target.classList.contains('translationbridge-inline-translated')) return;
          const inlineText = getInlineOriginalText(target);
          if (!inlineText) return;
          tasks.push({ element: target, mode: 'inline', originalText: inlineText });
        });
        continue;
      }

      if (node.tagName === 'LI') {
        if (isNavigationContext(node)) continue;
        if (listItemHasBlockContent(node)) continue;
      }

      const textContent = node.textContent?.trim();
      if (!textContent) continue;
      if (textContent.length <= 10) continue;

      tasks.push({ element: node, mode: 'block', originalText: textContent });
    }

    // Setup IntersectionObserver for visibility prioritization
    cleanupVisibilityObserver();
    
    // Fast path: if no tasks, just return
    if (tasks.length === 0) {
      mutationSuppressed = false;
      return;
    }

    await new Promise<void>((resolve) => {
      visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const taskIndex = tasks.findIndex(t => t.element === entry.target);
          if (taskIndex !== -1) {
            const task = tasks[taskIndex];
            if (entry.isIntersecting) {
              visibleTasks.push(task);
            } else {
              deferredTasks.push(task);
            }
          }
        });
        
        // Once we've observed all elements once, we can proceed
        if (visibleTasks.length + deferredTasks.length === tasks.length) {
          cleanupVisibilityObserver();
          resolve();
        }
      }, { rootMargin: '50% 0px 50% 0px' });

      tasks.forEach(task => {
        visibilityObserver!.observe(task.element);
      });
      
      // Fallback in case observer fails to trigger for some elements
      setTimeout(() => {
        if (visibilityObserver) {
          cleanupVisibilityObserver();
          // Add any remaining unclassified tasks to deferred
          const classifiedElements = new Set([...visibleTasks, ...deferredTasks].map(t => t.element));
          tasks.forEach(task => {
            if (!classifiedElements.has(task.element)) {
              deferredTasks.push(task);
            }
          });
          resolve();
        }
      }, 300);
    });

    console.log(\`Translation tasks: \${visibleTasks.length} visible, \${deferredTasks.length} deferred\`);

    const processTasks = async (taskList: TranslationTask[], isVisible: boolean) => {
      if (taskList.length === 0) return 0;
      
      const translationResults = await Promise.allSettled(
        taskList.map(task => translateText(task.originalText, targetLang))
      );

      let successCount = 0;
      let downloadPending = false;

      translationResults.forEach((result, index) => {
        const task = taskList[index];
        if (!task) return;

        if (result.status === 'fulfilled' && result.value) {
          if (typeof result.value === 'string' && isModelDownloadPlaceholder(result.value)) {
            downloadPending = true;
            return;
          }

          if (task.mode === 'inline' && result.value.startsWith('[')) {
            return;
          }

          if (task.mode === 'inline') {
            applyInlineTranslation(task.element, result.value);
          } else {
            applyBlockTranslation(task.element, result.value);
          }
          successCount += 1;
        }
      });
      
      return { successCount, downloadPending };
    };

    // Process visible tasks immediately
    const visibleResult = await processTasks(visibleTasks, true);
    let totalSuccessCount = visibleResult ? visibleResult.successCount : 0;
    let downloadPending = visibleResult ? visibleResult.downloadPending : false;

    // Process deferred tasks using requestIdleCallback
    if (deferredTasks.length > 0) {
      if ('requestIdleCallback' in window) {
        // Chunk deferred tasks to avoid blocking main thread too long
        const chunkSize = 10;
        let currentIndex = 0;
        
        const processNextChunk = (deadline: IdleDeadline) => {
          if (!autoTranslateEnabled) return;
          
          const chunk = deferredTasks.slice(currentIndex, currentIndex + chunkSize);
          if (chunk.length === 0) return;
          
          // Use standard Promise chain rather than top-level await in callback
          processTasks(chunk, false).then(result => {
             // Continue chunks
             currentIndex += chunkSize;
             if (currentIndex < deferredTasks.length) {
                window.requestIdleCallback(processNextChunk, { timeout: 2000 });
             }
          });
        };
        
        window.requestIdleCallback(processNextChunk, { timeout: 2000 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          if (autoTranslateEnabled) {
            processTasks(deferredTasks, false);
          }
        }, 100);
      }
    }

    const inlineTaskCount = visibleTasks.filter(task => task.mode === 'inline').length + 
                            deferredTasks.filter(task => task.mode === 'inline').length;
    const blockTaskCount = tasks.length - inlineTaskCount;
    
    console.log(
      \`Translation visible batch completed: \${visibleTasks.length} tasks processed, \${totalSuccessCount} successful translations\`
    );

    if (showIndicator && loadingId) {
      const manager = NotificationManager.getInstance();
      if (downloadPending) {
        manager.show({
          id: loadingId,
          message: 'Downloading translation model...',
          type: 'info',
          persistent: true,
        });
      } else {
        manager.dismiss(loadingId);
      }
    }`;

translatePageContent = translatePageContent.replace(
  /const tasks: TranslationTask\[\] = \[\];[\s\S]*?if \(showIndicator && loadingId\) \{[\s\S]*?manager\.dismiss\(loadingId\);\n      \}\n    \}/,
  prioritizeLogic
);

content = content.replace(match[0], translatePageContent);

fs.writeFileSync('src/content.ts', content);
console.log('Patched content.ts');
