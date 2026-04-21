(() => {
  'use strict';

  const BTN_ID = 'mrmr-header-btn';
  const HOST_ID = 'mrmr-modal-host';
  const MIN_DESKTOP_WIDTH = 1024;
  const MUTATION_DEBOUNCE_MS = 250;

  function createButton() {
    const a = document.createElement('a');
    a.id = BTN_ID;
    a.className = 'btn-wrapper text-base';
    a.href = 'javascript:void(0)';
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', 'Random Mod (Shift+R)');
    a.title = 'Random Mod (Shift+R)';
    a.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'width:36px',
      'height:36px',
      'border-radius:8px',
      'background:transparent',
      'color:#1bd96a',
      'cursor:pointer',
      'text-decoration:none',
      'transition:background .12s'
    ].join(';');
    a.innerHTML = [
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">',
      '<rect x="2" y="2" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/>',
      '<circle cx="7" cy="7" r="1.3" fill="currentColor"/>',
      '<circle cx="13" cy="7" r="1.3" fill="currentColor"/>',
      '<circle cx="10" cy="10" r="1.3" fill="currentColor"/>',
      '<circle cx="7" cy="13" r="1.3" fill="currentColor"/>',
      '<circle cx="13" cy="13" r="1.3" fill="currentColor"/>',
      '</svg>'
    ].join('');
    a.addEventListener('mouseenter', () => {
      a.style.background = 'rgba(27, 217, 106, 0.12)';
    });
    a.addEventListener('mouseleave', () => {
      a.style.background = 'transparent';
    });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
    return a;
  }

  function findHeaderSlot() {
    return document.querySelector('header.desktop-only > div:last-child.flex');
  }

  function reinject() {
    if (document.getElementById(BTN_ID)) return;
    const slot = findHeaderSlot();
    if (!slot) return;
    slot.insertBefore(createButton(), slot.firstChild);
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
    widget = MRMR.widget.create(host, { mode: 'modal' });
    return widget;
  }

  function openModal() {
    ensureWidget().open();
  }

  // ── SPA nav hooks (fast rAF) ────────────────────────────────
  let rafScheduled = false;
  const scheduleRaf = () => {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      reinject();
    });
  };

  const origPush = history.pushState;
  history.pushState = function () {
    const r = origPush.apply(this, arguments);
    scheduleRaf();
    return r;
  };
  const origReplace = history.replaceState;
  history.replaceState = function () {
    const r = origReplace.apply(this, arguments);
    scheduleRaf();
    return r;
  };
  window.addEventListener('popstate', scheduleRaf);

  // ── MutationObserver (trailing debounce 250ms) ──────────────
  let debounceTimer = null;
  const scheduleDebounced = () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      reinject();
    }, MUTATION_DEBOUNCE_MS);
  };
  const mo = new MutationObserver(scheduleDebounced);
  mo.observe(document.body, { childList: true, subtree: true });

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

  // First paint
  reinject();
})();
