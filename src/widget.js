window.MRMR = window.MRMR || {};
MRMR.widget = (() => {
  const { h, formatCount, LOADERS } = MRMR.utils;

  const SIDE_OPTIONS = ['Any', 'Client', 'Server'];
  const MATCH_OPTIONS = ['any', 'all'];

  const DICE_MARK_SVG = `
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="4" fill="#1bd96a"/>
      <circle cx="7" cy="7" r="1.3" fill="#08110c"/>
      <circle cx="13" cy="7" r="1.3" fill="#08110c"/>
      <circle cx="10" cy="10" r="1.3" fill="#08110c"/>
      <circle cx="7" cy="13" r="1.3" fill="#08110c"/>
      <circle cx="13" cy="13" r="1.3" fill="#08110c"/>
    </svg>`;

  const ICON_DOWNLOAD = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 1.5v5.5M3 5l2.5 2.5L8 5M1.5 9h8"/></svg>`;
  const ICON_HEART = `<svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M5.5 9.5s-3.5-2-3.5-4.5a2 2 0 013.5-1.3A2 2 0 019 5c0 2.5-3.5 4.5-3.5 4.5z"/></svg>`;
  const ICON_LIST = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#1bd96a" stroke-width="1.8" stroke-linecap="round"><path d="M2 4h8M2 6h8M2 8h5"/></svg>`;
  const ICON_CHEVRON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4L5 6.5 7.5 4"/></svg>`;

  function create(host, opts) {
    opts = opts || {};
    const mode = opts.mode || 'modal';
    const isModal = mode === 'modal';

    // Root + styles
    let root, backdrop;
    if (isModal) {
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = MRMR.css;
      shadow.appendChild(style);
      backdrop = h('div', { class: 'mr-backdrop mr-root' });
      shadow.appendChild(backdrop);
      root = backdrop;
      backdrop.style.display = 'none';
    } else {
      const style = document.createElement('style');
      style.textContent = MRMR.css;
      host.appendChild(style);
      host.classList.add('mr-root');
      root = host;
    }

    // Panel structure (built once)
    const closeBtn = isModal
      ? h('button', {
          class: 'mr-close-btn',
          'aria-label': 'Close',
          title: 'Close',
          onClick: () => api.close()
        }, '×')
      : null;

    const headerEl = h('div', { class: 'mr-header' },
      h('div', { class: 'mr-brand' },
        h('span', { class: 'mr-brand-logo', html: DICE_MARK_SVG }),
        h('span', { class: 'mr-brand-text' }, 'Random Mod')
      )
    );

    const bodyEl = h('div', { class: 'mr-body' });
    const footerEl = h('div', { class: 'mr-footer-slot' });

    const panel = h('div',
      { class: 'mr-panel' + (isModal ? '' : ' mr-panel-popup') },
      closeBtn, headerEl, bodyEl, footerEl
    );

    if (isModal) backdrop.appendChild(panel);
    else root.appendChild(panel);

    // State
    let state = 'filters';
    let filters = { ...MRMR.storage.DEFAULT_FILTERS };
    let lastResult = null;
    let lastError = null;
    let releases = [];
    let categories = [];
    let filtersOpenInResult = false;
    let isOpen = !isModal;
    let triggerEl = null;

    // Event: Escape to close (modal only)
    const onKeydown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        api.close();
      }
    };

    // Backdrop click to close (modal only)
    if (isModal) {
      backdrop.addEventListener('pointerdown', (e) => {
        if (e.target === backdrop) api.close();
      });
    }

    // ── Save / setters ────────────────────────────────────────
    function persist() { MRMR.storage.setFilters(filters).catch(() => {}); }

    function updateFilters(patch) {
      filters = { ...filters, ...patch };
      persist();
    }

    function setState(next) { state = next; render(); }

    function resetFilters() {
      filters = { ...MRMR.storage.DEFAULT_FILTERS };
      persist();
      render();
    }

    async function roll() {
      setState('loading');
      lastError = null;
      try {
        const r = await MRMR.api.searchRandomMod(filters);
        if (r.empty) {
          setState('empty');
        } else {
          lastResult = r;
          filtersOpenInResult = false;
          setState('result');
        }
      } catch (e) {
        lastError = (e && e.message) || 'Network error';
        setState('error');
      }
    }

    function openModrinth() {
      if (!lastResult || !lastResult.mod) return;
      const url = 'https://modrinth.com/mod/' + lastResult.mod.slug;
      window.open(url, '_blank', 'noopener');
    }

    // ── Render helpers ────────────────────────────────────────
    function renderPill(label, selected, onClick) {
      return h('button', {
        class: 'mr-pill' + (selected ? ' is-selected' : ''),
        onClick
      }, label);
    }

    function renderFiltersBody(dimmed) {
      const toggle = (key, v) => {
        const arr = filters[key];
        const next = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
        updateFilters({ [key]: next });
        render();
      };

      // Loader pills
      const loaderPills = LOADERS.map(l =>
        renderPill(l, filters.loaders.includes(l), () => toggle('loaders', l))
      );

      // Version selects — populated from `releases`
      const makeVersionSelect = (current, onchange) => {
        const sel = h('select', {
          class: 'mr-select',
          onChange: (e) => onchange(e.target.value)
        });
        sel.appendChild(h('option', { value: '' }, 'Any'));
        for (const v of releases) {
          const opt = h('option', { value: v.version }, v.version);
          if (v.version === current) opt.selected = true;
          sel.appendChild(opt);
        }
        return sel;
      };

      const versionRange = h('div', { class: 'mr-version-range' },
        h('div', null,
          h('div', { class: 'mr-version-cap' }, 'FROM'),
          makeVersionSelect(filters.versionFrom, v => { updateFilters({ versionFrom: v }); })
        ),
        h('div', { class: 'mr-version-arrow' }, '→'),
        h('div', null,
          h('div', { class: 'mr-version-cap' }, 'TO'),
          makeVersionSelect(filters.versionTo, v => { updateFilters({ versionTo: v }); })
        )
      );

      // Categories — from API
      const catPills = categories.map(c =>
        renderPill(c, filters.categories.includes(c), () => toggle('categories', c))
      );

      // Match any/all sub-segment
      const matchWrap = h('div', { class: 'mr-match-wrap' },
        h('span', { class: 'mr-match-hint' }, 'Match'),
        h('div', { class: 'mr-match' },
          MATCH_OPTIONS.map(o => h('button', {
            class: 'mr-match-btn' + (filters.match === o ? ' is-active' : ''),
            onClick: () => { updateFilters({ match: o }); render(); }
          }, o))
        )
      );

      // Side segmented
      const sideSeg = h('div', { class: 'mr-segmented' },
        SIDE_OPTIONS.map(o => h('button', {
          class: 'mr-seg-btn' + (filters.side === o ? ' is-active' : ''),
          onClick: () => { updateFilters({ side: o }); render(); }
        }, o))
      );

      // Min downloads
      const minInput = h('input', {
        class: 'mr-num-input',
        type: 'text',
        inputmode: 'numeric',
        value: filters.minDownloads || '',
        placeholder: '0'
      });
      minInput.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/[^0-9]/g, '');
        if (cleaned !== e.target.value) e.target.value = cleaned;
        filters = { ...filters, minDownloads: cleaned };
        persist();
      });

      return h('div', { class: 'mr-filters' + (dimmed ? ' is-dimmed' : '') },
        h('div', null,
          h('div', { class: 'mr-section-label' }, 'Loader'),
          h('div', { class: 'mr-pills' }, loaderPills)
        ),
        h('div', null,
          h('div', { class: 'mr-section-label' }, 'Version range'),
          versionRange
        ),
        h('div', null,
          h('div', { class: 'mr-section-label' },
            h('span', null, 'Categories'),
            matchWrap
          ),
          categories.length
            ? h('div', { class: 'mr-pills' }, catPills)
            : h('div', { style: 'font-size:12px;color:var(--mr-text-faint);' }, 'Loading…')
        ),
        h('div', null,
          h('div', { class: 'mr-section-label' }, 'Side'),
          sideSeg
        ),
        h('div', { class: 'mr-section-row' },
          h('div', null,
            h('div', { class: 'mr-section-label' }, 'Min downloads'),
            minInput
          ),
          h('button', {
            class: 'mr-reset-btn',
            onClick: () => resetFilters()
          }, 'Reset filters')
        )
      );
    }

    function renderSummaryBar() {
      const parts = [];
      if (filters.loaders.length) {
        parts.push(filters.loaders.length > 3
          ? filters.loaders.length + ' loaders'
          : filters.loaders.join(', '));
      }
      const vFrom = filters.versionFrom || 'any';
      const vTo = filters.versionTo || 'any';
      if (filters.versionFrom || filters.versionTo) parts.push(vFrom + '–' + vTo);
      if (filters.side !== 'Any') parts.push(filters.side + ' side');
      if (filters.categories.length) parts.push(filters.categories.length + ' cat.');

      return h('button', {
        class: 'mr-summary-bar',
        onClick: () => { filtersOpenInResult = !filtersOpenInResult; render(); }
      },
        h('div', { class: 'mr-summary-left' },
          h('span', { html: ICON_LIST }),
          h('span', { class: 'mr-summary-text' }, parts.join(' · ') || 'No filters')
        ),
        h('span', { class: 'mr-summary-edit' },
          filtersOpenInResult ? 'Close' : 'Edit',
          h('span', { html: ICON_CHEVRON, style: filtersOpenInResult ? 'transform:rotate(180deg);' : '' })
        )
      );
    }

    function renderModCard(mod, biased) {
      const iconEl = mod.icon_url
        ? h('img', { class: 'mr-mod-icon', src: mod.icon_url, alt: '' })
        : h('div', { class: 'mr-mod-icon-fallback' }, (mod.title || '?').charAt(0).toUpperCase());

      const biasedBadge = biased
        ? h('button', {
            class: 'mr-biased-badge',
            title: 'Very popular filter set — random pick is slightly biased toward the top 10 000 results.',
            'aria-label': 'Biased pick'
          }, '?')
        : null;

      const loaderChips = Array.isArray(mod.loaders)
        ? mod.loaders.map(l => h('span', { class: 'mr-mod-loader-chip' }, l))
        : [];

      return h('div', { class: 'mr-mod-card' },
        h('div', { class: 'mr-mod-head' },
          iconEl,
          h('div', { class: 'mr-mod-meta' },
            h('div', { class: 'mr-mod-title-row' },
              h('div', { class: 'mr-mod-title' }, mod.title || 'Untitled'),
              biasedBadge
            ),
            h('div', { class: 'mr-mod-author' },
              'by ',
              h('span', { class: 'mr-mod-author-name' }, mod.author || 'unknown')
            ),
            h('div', { class: 'mr-mod-stats' },
              h('span', { class: 'mr-mod-stat' },
                h('span', { html: ICON_DOWNLOAD }),
                formatCount(mod.downloads)
              ),
              h('span', { class: 'mr-mod-stat' },
                h('span', { html: ICON_HEART }),
                formatCount(mod.follows)
              )
            )
          )
        ),
        h('div', { class: 'mr-mod-desc' }, mod.description || ''),
        loaderChips.length ? h('div', { class: 'mr-mod-loaders' }, loaderChips) : null
      );
    }

    function renderResult() {
      const { mod, biased } = lastResult;
      return [
        renderSummaryBar(),
        filtersOpenInResult ? renderFiltersBody(false) : null,
        h('div', { class: 'mr-result-body' },
          renderModCard(mod, biased),
          h('div', { class: 'mr-result-actions' },
            h('button', {
              class: 'mr-btn mr-btn-primary',
              onClick: () => openModrinth()
            }, 'Open on Modrinth'),
            h('button', {
              class: 'mr-btn mr-btn-secondary',
              onClick: () => roll()
            },
              h('span', null, '🎲'),
              h('span', null, 'Roll again')
            )
          )
        )
      ];
    }

    function renderCentered(cfg) {
      return h('div', { class: 'mr-centered' + (cfg.danger ? ' is-danger' : '') },
        h('div', { class: 'mr-centered-icon' }, cfg.glyph),
        h('div', null,
          h('div', { class: 'mr-centered-title' }, cfg.title),
          h('div', { class: 'mr-centered-body' }, cfg.body)
        ),
        h('div', { class: 'mr-centered-cta' },
          h('button', { class: 'mr-btn mr-btn-primary', onClick: cfg.onCta }, cfg.cta)
        )
      );
    }

    // ── Main render ───────────────────────────────────────────
    function render() {
      // Body
      const body = [];
      if (state === 'filters') body.push(renderFiltersBody(false));
      else if (state === 'loading') body.push(renderFiltersBody(true));
      else if (state === 'result') body.push(...renderResult());
      else if (state === 'empty') body.push(renderCentered({
        glyph: '😕',
        title: 'Nothing rolled',
        body: 'No mods match these filters. Try loosening them.',
        cta: 'Adjust filters',
        onCta: () => setState('filters')
      }));
      else if (state === 'error') body.push(renderCentered({
        glyph: '⚠',
        title: 'Modrinth is unreachable',
        body: lastError ? 'Details: ' + lastError : 'Check your connection and try again.',
        cta: 'Retry',
        danger: true,
        onCta: () => roll()
      }));

      bodyEl.replaceChildren(...body.filter(Boolean));

      // Footer
      footerEl.replaceChildren();
      if (state === 'filters') {
        footerEl.className = 'mr-footer';
        footerEl.appendChild(
          h('button', { class: 'mr-btn mr-btn-primary', onClick: () => roll() },
            h('span', { style: 'font-size:16px;' }, '🎲'),
            h('span', null, 'Random Mod')
          )
        );
      } else if (state === 'loading') {
        footerEl.className = 'mr-footer-loading';
        footerEl.appendChild(h('div', { class: 'mr-spinner' }));
        footerEl.appendChild(h('div', { class: 'mr-loading-text' }, 'Rolling the dice…'));
      } else {
        footerEl.className = 'mr-footer-slot';
      }
    }

    // ── Init flow ─────────────────────────────────────────────
    (async () => {
      try {
        filters = await MRMR.storage.getFilters();
      } catch { /* empty — use defaults */ }
      render(); // first paint with what we have
      try {
        const gv = await MRMR.api.getGameVersions();
        releases = gv.filter(v => v.version_type === 'release');
      } catch { /* leave empty — user can still pick loaders */ }
      try {
        categories = await MRMR.api.getCategories();
      } catch { /* leave empty */ }
      render(); // re-paint with populated tag lists
    })();

    // ── Public API ────────────────────────────────────────────
    const api = {
      open() {
        if (isModal) {
          triggerEl = document.activeElement;
          backdrop.style.display = 'flex';
          document.addEventListener('keydown', onKeydown);
          const prevOverflow = document.body.style.overflow;
          backdrop.dataset.prevOverflow = prevOverflow;
          document.body.style.overflow = 'hidden';
        }
        isOpen = true;
        setTimeout(() => panel.focus(), 0);
      },
      close() {
        if (!isOpen) return;
        if (isModal) {
          backdrop.style.display = 'none';
          document.removeEventListener('keydown', onKeydown);
          document.body.style.overflow = backdrop.dataset.prevOverflow || '';
          if (triggerEl && typeof triggerEl.focus === 'function') {
            try { triggerEl.focus(); } catch {}
          }
        }
        isOpen = false;
      },
      toggle() { isOpen ? api.close() : api.open(); },
      destroy() {
        document.removeEventListener('keydown', onKeydown);
        if (host && host.parentNode) host.parentNode.removeChild(host);
      },
      get isOpen() { return isOpen; }
    };

    return api;
  }

  return { create };
})();
