/* Warm only the current artwork and the next likely view. Keep the original SVGs
   and let the browser's normal HTTP/image cache serve the visible image elements. */
(() => {
  'use strict';
  const details = ['stile', 'rung', 'foot', 'lock'].map(part => `assets/inspection-${part}-detail.svg`);
  const images = new Map();
  let view = 0;
  function warm(src) {
    if (images.has(src)) return images.get(src).ready;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    const entry = { image };
    images.set(src, entry);
    entry.ready = new Promise(resolve => {
      image.onload = async () => {
        // Retain the decoded image for reuse, without delaying navigation or animation.
        try { await image.decode?.(); } catch { /* Visible images retain native fallback. */ }
        resolve(true);
      };
      image.onerror = () => { images.delete(src); resolve(false); };
      image.src = src;
    });
    return entry.ready;
  }
  function prepare(stage, active) {
    const currentView = ++view;
    if (stage === 0 || stage === 1) {
      warm('assets/inspection.svg');
      const current = details[active];
      if (!current) return;
      warm(current).then(ready => {
        // The introduction warms only the entry view. In the activity, fetch just
        // one view ahead; do not compete with the current image's load/decode.
        if (ready && currentView === view && stage === 1) warm(details[active + 1] || 'assets/rung-detail.svg');
      });
    } else if (stage === 2) {
      warm('assets/rung-detail.svg').then(ready => { if (ready && currentView === view) warm('assets/setup.svg'); });
    }
  }
  window.FieldworkImages = Object.freeze({ prepare });
})();
