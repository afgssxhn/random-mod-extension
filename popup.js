(() => {
  'use strict';
  (async () => {
    let site = 'modrinth';
    try { site = (await MRMR.site.detectActiveTab()) || 'modrinth'; } catch {}
    MRMR.widget.create(document.body, { mode: 'popup', site }).open();
  })();
})();
