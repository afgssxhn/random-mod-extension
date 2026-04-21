window.MRMR = window.MRMR || {};
MRMR.css = `
:host, .mr-root {
  --mr-bg: #1b1c22;
  --mr-surface: #26272e;
  --mr-surface-hi: #2f3038;
  --mr-border: #3a3b42;
  --mr-border-soft: #2f3038;
  --mr-border-hover: #55565e;
  --mr-green: #1bd96a;
  --mr-green-hi: #25e77a;
  --mr-green-fg: #08110c;
  --mr-green-tint: rgba(27, 217, 106, 0.10);
  --mr-green-edge: rgba(27, 217, 106, 0.25);
  --mr-green-glow: rgba(27, 217, 106, 0.15);
  --mr-text: #ffffff;
  --mr-text-dim: #9a9a9a;
  --mr-text-faint: #6e6f76;
  --mr-text-body: #c8c9cf;
  --mr-text-author: #b8b9c0;
  --mr-danger: #ff6b6b;
  --mr-danger-tint: rgba(255, 107, 107, 0.10);
  --mr-danger-edge: rgba(255, 107, 107, 0.25);
}

.mr-root, .mr-root * { box-sizing: border-box; }
.mr-root {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  color: var(--mr-text);
}

/* Backdrop (modal mode only) */
.mr-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483646;
  animation: mr-fade-in .12s ease-out;
}
@keyframes mr-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* Panel */
.mr-panel {
  width: 400px;
  height: 600px;
  background: var(--mr-bg);
  border-radius: 12px;
  border: 1px solid var(--mr-border);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  animation: mr-scale-in .14s ease-out;
}
@keyframes mr-scale-in { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.mr-panel-popup {
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: none;
  box-shadow: none;
  animation: none;
}

/* Close button (modal mode) */
.mr-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .12s, color .12s;
}
.mr-close-btn:hover { background: var(--mr-surface); color: var(--mr-text); }

/* Header */
.mr-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 12px 14px;
  border-bottom: 1px solid var(--mr-border-soft);
  background: var(--mr-bg);
  flex-shrink: 0;
  gap: 8px;
}
.mr-brand { display: flex; align-items: center; gap: 8px; }
.mr-brand-text { font-size: 14px; font-weight: 600; color: var(--mr-text); letter-spacing: -.2px; }

/* Scroll area */
.mr-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.mr-body::-webkit-scrollbar { width: 6px; }
.mr-body::-webkit-scrollbar-track { background: transparent; }
.mr-body::-webkit-scrollbar-thumb { background: var(--mr-border); border-radius: 3px; }
.mr-body::-webkit-scrollbar-thumb:hover { background: var(--mr-border-hover); }

/* Filters section */
.mr-filters {
  padding: 16px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  transition: opacity .2s;
}
.mr-filters.is-dimmed { opacity: 0.45; pointer-events: none; }

.mr-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: var(--mr-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 8px;
}

/* Pills (loaders, categories) */
.mr-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.mr-pill {
  appearance: none;
  border: 1px solid var(--mr-border);
  background: transparent;
  color: var(--mr-text-dim);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: -.1px;
  white-space: nowrap;
  transition: background .12s, color .12s, border-color .12s;
}
.mr-pill:hover { border-color: var(--mr-border-hover); color: var(--mr-text); }
.mr-pill.is-selected {
  background: var(--mr-green);
  border-color: var(--mr-green);
  color: var(--mr-green-fg);
  font-weight: 600;
}
.mr-pill.is-selected:hover { background: var(--mr-green); color: var(--mr-green-fg); }

/* Match any/all sub-segment */
.mr-match-wrap {
  display: flex; align-items: center; gap: 6px;
  text-transform: none; letter-spacing: 0;
}
.mr-match-hint { color: var(--mr-text-faint); font-size: 11px; font-weight: 500; }
.mr-match {
  display: flex;
  background: var(--mr-bg);
  border: 1px solid var(--mr-border);
  border-radius: 6px;
  padding: 1px;
}
.mr-match-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  padding: 2px 9px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.mr-match-btn.is-active {
  background: var(--mr-surface-hi);
  color: var(--mr-text);
  font-weight: 600;
}

/* Version range */
.mr-version-range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
}
.mr-version-cap {
  font-size: 10px;
  color: var(--mr-text-faint);
  margin-bottom: 4px;
  letter-spacing: 0.3px;
}
.mr-version-arrow { color: var(--mr-text-faint); margin-top: 14px; text-align: center; font-size: 13px; }
.mr-select {
  width: 100%;
  background: var(--mr-bg);
  border: 1px solid var(--mr-border);
  border-radius: 8px;
  padding: 8px 28px 8px 10px;
  color: var(--mr-text);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='%239a9a9a' stroke-width='1.5' stroke-linecap='round'><path d='M2.5 4L5 6.5 7.5 4'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 10px 10px;
  transition: border-color .12s;
}
.mr-select:hover, .mr-select:focus { border-color: var(--mr-border-hover); outline: none; }
.mr-select:empty:not(:focus)::before { content: attr(data-placeholder); color: var(--mr-text-dim); }
.mr-select option { background: var(--mr-surface); color: var(--mr-text); }

/* Segmented control (Side) */
.mr-segmented {
  display: flex;
  background: var(--mr-bg);
  border: 1px solid var(--mr-border);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}
.mr-seg-btn {
  flex: 1;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background .12s, color .12s;
}
.mr-seg-btn.is-active {
  background: var(--mr-surface-hi);
  color: var(--mr-text);
  font-weight: 600;
}

/* Min downloads + Reset row */
.mr-section-row { display: flex; align-items: flex-end; gap: 12px; }
.mr-section-row > div { flex: 1; min-width: 0; }
.mr-num-input {
  width: 100%;
  background: var(--mr-bg);
  border: 1px solid var(--mr-border);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--mr-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color .12s;
}
.mr-num-input:focus { border-color: var(--mr-green); }
.mr-reset-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 4px;
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color .12s;
}
.mr-reset-btn:hover { color: var(--mr-text); }

/* Footer (CTA or loading) */
.mr-footer {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--mr-border-soft);
  background: var(--mr-bg);
  flex-shrink: 0;
}
.mr-footer-loading {
  padding: 14px;
  border-top: 1px solid var(--mr-border-soft);
  background: var(--mr-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.mr-spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--mr-border);
  border-top-color: var(--mr-green);
  animation: mr-spin .8s linear infinite;
}
@keyframes mr-spin { to { transform: rotate(360deg); } }
.mr-loading-text { font-size: 12px; color: var(--mr-text-dim); font-weight: 500; }

/* Buttons */
.mr-btn {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 11px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  letter-spacing: -.2px;
  transition: background .12s, box-shadow .12s;
  width: 100%;
}
.mr-btn-primary {
  background: var(--mr-green);
  color: var(--mr-green-fg);
}
.mr-btn-primary:hover {
  background: var(--mr-green-hi);
  box-shadow: 0 0 0 3px var(--mr-green-glow);
}
.mr-btn-secondary {
  background: transparent;
  border: 1px solid var(--mr-border);
  color: var(--mr-text);
  font-weight: 600;
  padding: 10px 14px;
  font-size: 13px;
  gap: 6px;
}
.mr-btn-secondary:hover { background: var(--mr-surface-hi); }

/* Summary bar (result state) */
.mr-summary-bar {
  width: 100%;
  text-align: left;
  background: var(--mr-surface);
  border: none;
  border-bottom: 1px solid var(--mr-border-soft);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  font-family: inherit;
  color: var(--mr-text);
  transition: background .12s;
}
.mr-summary-bar:hover { background: var(--mr-surface-hi); }
.mr-summary-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mr-summary-text {
  font-size: 12px;
  color: var(--mr-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mr-summary-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--mr-text);
  font-weight: 500;
  flex-shrink: 0;
}

/* Result body */
.mr-result-body { padding: 14px; }
.mr-mod-card {
  background: var(--mr-surface);
  border: 1px solid var(--mr-border);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mr-mod-head { display: flex; gap: 12px; }
.mr-mod-icon {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  background: var(--mr-bg);
}
.mr-mod-icon-fallback {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #3d7a4a 0%, #6bb877 50%, #a8d98f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--mr-green-fg);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.mr-mod-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.mr-mod-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.mr-mod-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--mr-text);
  letter-spacing: -.3px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.mr-biased-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--mr-border);
  background: var(--mr-bg);
  color: var(--mr-text-faint);
  font-size: 9px;
  font-weight: 700;
  cursor: help;
  flex-shrink: 0;
  font-family: inherit;
}
.mr-mod-author { font-size: 12px; color: var(--mr-text-dim); margin-top: 3px; }
.mr-mod-author-name { color: var(--mr-text-author); }
.mr-mod-stats {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  align-items: center;
}
.mr-mod-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--mr-text-dim);
  font-variant-numeric: tabular-nums;
}
.mr-mod-desc {
  font-size: 12.5px;
  color: var(--mr-text-body);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mr-mod-loaders { display: flex; flex-wrap: wrap; gap: 5px; }
.mr-mod-loader-chip {
  font-size: 10px;
  font-weight: 600;
  color: var(--mr-green);
  background: var(--mr-green-tint);
  border: 1px solid var(--mr-green-edge);
  border-radius: 4px;
  padding: 2px 6px;
  letter-spacing: 0.2px;
  text-transform: uppercase;
}

/* Result buttons row */
.mr-result-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.mr-result-actions .mr-btn-primary { font-size: 13px; padding: 10px 14px; }

/* Centered state (empty / error) */
.mr-centered {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 28px;
  text-align: center;
  gap: 14px;
}
.mr-centered-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--mr-surface);
  border: 1px solid var(--mr-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.mr-centered.is-danger .mr-centered-icon {
  background: var(--mr-danger-tint);
  border-color: var(--mr-danger-edge);
}
.mr-centered-title { font-size: 16px; font-weight: 700; color: var(--mr-text); letter-spacing: -.3px; }
.mr-centered-body {
  font-size: 12.5px;
  color: var(--mr-text-dim);
  margin-top: 6px;
  line-height: 1.5;
  max-width: 260px;
}
.mr-centered-cta { margin-top: 4px; width: 100%; }
`;
