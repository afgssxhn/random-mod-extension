(() => {
  'use strict';

  const BTN_HOST_ID = 'mrmr-btn-host';
  const HOST_ID = 'mrmr-modal-host';
  const MIN_DESKTOP_WIDTH = 1024;

  const SITE = (window.MRMR && MRMR.site && MRMR.site.detect()) || 'modrinth';
  const ACCENTS = {
    modrinth:   { color: '#1bd96a', edge: 'rgba(27, 217, 106, 0.35)', hover: 'rgba(27, 217, 106, 0.16)' },
    curseforge: { color: '#f16436', edge: 'rgba(241, 100, 54, 0.35)', hover: 'rgba(241, 100, 54, 0.16)' }
  };
  const AC = ACCENTS[SITE] || ACCENTS.modrinth;
  const BTN_BG = '#121013';

  function createButton() {
    const a = document.createElement('a');
    a.id = 'mrmr-roll-btn';
    a.href = 'javascript:void(0)';
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', 'Random Mod (Shift+R)');
    a.title = 'Random Mod (Shift+R)';
    // Standalone floating button (not blended into Modrinth's header).
    a.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'width:44px',
      'height:44px',
      'border-radius:12px',
      'background:' + BTN_BG,
      'border:1px solid ' + AC.edge,
      'color:' + AC.color,
      'cursor:pointer',
      'text-decoration:none',
      'box-shadow:0 4px 14px rgba(0, 0, 0, 0.35)',
      'transition:background .12s, transform .12s'
    ].join(';');
    a.innerHTML = [
      '<svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">',
      '<rect x="2" y="2" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/>',
      '<circle cx="7" cy="7" r="1.3" fill="currentColor"/>',
      '<circle cx="13" cy="7" r="1.3" fill="currentColor"/>',
      '<circle cx="10" cy="10" r="1.3" fill="currentColor"/>',
      '<circle cx="7" cy="13" r="1.3" fill="currentColor"/>',
      '<circle cx="13" cy="13" r="1.3" fill="currentColor"/>',
      '</svg>'
    ].join('');
    a.addEventListener('mouseenter', () => {
      a.style.background = AC.hover;
    });
    a.addEventListener('mouseleave', () => {
      a.style.background = BTN_BG;
    });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
    return a;
  }

  // Body-level, fixed-position host. It lives OUTSIDE Nuxt's app root
  // (#__nuxt), so Vue never patches it — no hydration corruption and no
  // `$_detachPopperNode` / `parentNode` crash. We never write into Modrinth's
  // Vue-managed DOM.
  function ensureButton() {
    // Desktop-only: on mobile the widget is reached via the extension popup.
    if (window.innerWidth < MIN_DESKTOP_WIDTH) {
      const existing = document.getElementById(BTN_HOST_ID);
      if (existing) existing.remove();
      return;
    }
    if (document.getElementById(BTN_HOST_ID)) return;
    const host = document.createElement('div');
    host.id = BTN_HOST_ID;
    host.style.cssText = [
      'position:fixed',
      'top:72px',   // just below the site header band, off its controls
      'right:16px',
      'z-index:2147483000',   // below the modal backdrop (2147483646)
      'margin:0',
      'padding:0',
      // CurseForge ships a global rule that leaks min-width:1272px onto bare
      // <div>s — it stretched this host and pushed the button to mid-screen.
      // Pin the host to its content size and beat any such site rule.
      'min-width:0 !important',
      'min-height:0 !important',
      'width:max-content !important',
      'max-width:max-content !important'
    ].join(';');
    host.appendChild(createButton());
    document.body.appendChild(host);
  }

  // Lazy modal instance
  let widget = null;
  function ensureWidget() {
    if (widget) return widget;
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      document.body.appendChild(host);
    }
    widget = MRMR.widget.create(host, { mode: 'modal', site: SITE });
    return widget;
  }

  function openModal() {
    ensureWidget().open();
  }

  // ── Keep our own host alive ─────────────────────────────────
  // Observe ONLY document.body's direct children (no subtree). This never
  // inspects or mutates Vue-managed DOM; it just re-creates our own body-level
  // node if something removes it. Safe across SPA navigation and re-renders.
  const mo = new MutationObserver(() => {
    if (window.innerWidth >= MIN_DESKTOP_WIDTH && !document.getElementById(BTN_HOST_ID)) {
      ensureButton();
    }
  });
  mo.observe(document.body, { childList: true });

  // ── Show/hide when crossing the desktop width threshold ─────
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(ensureButton, 150);
  });

  // ── Hotkey: Shift+R (layout-independent via e.code) ─────────
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR') return;
    if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (window.innerWidth < MIN_DESKTOP_WIDTH) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    openModal();
  });

  // ── Popup transport (CurseForge only) ──────────────────────
  // The popup runs on chrome-extension:// and can't reach CurseForge's
  // internal API same-origin (Cloudflare). It messages the active CF tab;
  // we answer here with a same-origin fetch in the user's real session.
  if (SITE === 'curseforge' && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg.type !== 'string') return;
      const reply = (p) => p
        .then(result => sendResponse({ result }))
        .catch(err => sendResponse({ error: (err && err.message) || 'CurseForge error' }));
      if (msg.type === 'MRMR_CF_SEARCH') {
        reply(MRMR.api.searchRandomMod(msg.filters, 'curseforge'));
        return true; // keep the channel open for the async response
      }
      if (msg.type === 'MRMR_CF_CATEGORIES') {
        reply(MRMR.api.getCategories('curseforge'));
        return true;
      }
    });
  }

  // First paint
  ensureButton();
})();
