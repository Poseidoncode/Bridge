// 1) 功能偵測：確認瀏覽器支援 Translator API
if (!('Translator' in self)) {
  console.error('Translator API not supported in this browser.');
} else {
  console.log('Translator API is supported.');
}

// 2) 檢查模型/語言包可用性
(async () => {
  const status = await Translator.availability({
    sourceLanguage: 'en',
    targetLanguage: 'fr',
  });
  console.log('Availability:', status); // 'available' | 'downloadable' | 'unavailable'

  // 若為 downloadable，監聽下載進度
  const translator = await Translator.create({
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        console.log(`Downloaded ${e.loaded * 100}%`);
      });
    },
  });

  // 3) 嘗試翻譯：驗證實際可用
  try {
    const result = await translator.translate('Where is the next bus stop, please?');
    console.log('Translation:', result);
  } catch (err) {
    console.error('Translate failed:', err);
  }
})();
