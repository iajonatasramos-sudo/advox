// Content scripts MV3 não aceitam módulos ES: este loader importa o bundle real.
(async () => {
  try {
    await import(chrome.runtime.getURL('assets/content.js'));
  } catch (e) {
    console.error('[Advox] falha ao carregar a extensão:', e);
  }
})();
