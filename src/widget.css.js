window.MRMR = window.MRMR || {};
MRMR.css = `
:host, .mr-root {
  /* ── Neutrals (Concept C — Expressive) ── */
  --mr-bg: #121013;
  --mr-border: #322c36;
  --mr-divider: #221e25;
  --mr-surface: #1c1820;
  --mr-surface-border: #3a333f;
  --mr-surface-hi: #231e28;
  --mr-card-bg: #1a161e;
  --mr-stat-bg: #121013;
  --mr-stat-border: #2a2530;
  --mr-text: #ffffff;
  --mr-text-strong: #dfdfdf;
  --mr-text-dim: #b2b2b2;
  --mr-text-faint: #7a7280;
  --mr-text-muted: #999999;
  --mr-scrollbar: #3a333f;
  --mr-danger: #be6464;
  --mr-danger-tint: rgba(190, 100, 100, 0.14);
  --mr-danger-edge: rgba(190, 100, 100, 0.34);

  /* ── Accent: one swappable token group (default Modrinth green;
        per-site swap is added in Phase B). ── */
  --mr-accent: #1bd96a;
  --mr-accent-hi: #25e77a;
  --mr-accent-fg: #08110c;
  --mr-accent-tint: rgba(27, 217, 106, 0.10);
  --mr-accent-edge: rgba(27, 217, 106, 0.28);
  --mr-accent-glow: rgba(27, 217, 106, 0.18);
  /* select chevron is part of the swappable group (a data-URI can't read a
     CSS var, so the whole URL is the token). */
  --mr-chevron: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='%231bd96a' stroke-width='1.5' stroke-linecap='round'><path d='M2.5 4L5 6.5 7.5 4'/></svg>");
}

/* ── Per-site accent swap (set via a class on the widget root) ── */
.mr-root.mr-site-modrinth {
  --mr-accent: #1bd96a;
  --mr-accent-hi: #25e77a;
  --mr-accent-fg: #08110c;
  --mr-accent-tint: rgba(27, 217, 106, 0.10);
  --mr-accent-edge: rgba(27, 217, 106, 0.28);
  --mr-accent-glow: rgba(27, 217, 106, 0.18);
  --mr-chevron: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='%231bd96a' stroke-width='1.5' stroke-linecap='round'><path d='M2.5 4L5 6.5 7.5 4'/></svg>");
}
.mr-root.mr-site-curseforge {
  --mr-accent: #f16436;
  --mr-accent-hi: #eb622b;
  --mr-accent-fg: #1f0d04;
  --mr-accent-tint: rgba(241, 100, 54, 0.10);
  --mr-accent-edge: rgba(241, 100, 54, 0.30);
  --mr-accent-glow: rgba(241, 100, 54, 0.20);
  --mr-chevron: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='%23f16436' stroke-width='1.5' stroke-linecap='round'><path d='M2.5 4L5 6.5 7.5 4'/></svg>");
}

.mr-root, .mr-root * { box-sizing: border-box; }
.mr-root {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  color: var(--mr-text);
}

/* ── Animations ── */
@keyframes mr-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes rm-pop { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes rm-spin { to { transform: rotate(360deg); } }
@keyframes rm-dice { 0%,70%,100% { transform: rotate(0); } 80% { transform: rotate(-18deg); } 90% { transform: rotate(14deg); } }
@keyframes rm-roll { 0% { transform: rotate(0) scale(1); } 50% { transform: rotate(180deg) scale(1.1); } 100% { transform: rotate(360deg) scale(1); } }
@keyframes rm-pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes rm-cardin { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ── Backdrop (modal mode only) ── */
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

/* ── Panel ── */
.mr-panel {
  width: 400px;
  height: 600px;
  background: var(--mr-bg);
  border-radius: 16px;
  border: 1px solid var(--mr-border);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  color: var(--mr-text);
  animation: rm-pop .3s ease-out;
}
.mr-panel-popup {
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: none;
  box-shadow: none;
  animation: none;
}
/* Keep the real content above the glow layer. */
.mr-panel > .mr-header,
.mr-panel > .mr-body,
.mr-panel > .mr-footer,
.mr-panel > .mr-footer-loading,
.mr-panel > .mr-footer-slot { position: relative; z-index: 1; }

/* ── Background glow (cosmetic; toggleable) ── */
.mr-glow {
  position: absolute;
  top: -90px;
  left: -50px;
  width: 300px;
  height: 210px;
  background: var(--mr-accent-glow);
  filter: blur(64px);
  pointer-events: none;
  z-index: 0;
}
.mr-panel.is-glow-off .mr-glow { display: none; }

/* ── Close button (modal mode) ── */
.mr-close-btn {
  position: absolute;
  top: 13px;
  right: 14px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  z-index: 5;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .12s, color .12s;
}
.mr-close-btn:hover { background: var(--mr-surface); color: var(--mr-text); }

/* ── Header ── */
.mr-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--mr-divider);
  background: var(--mr-bg);
  flex-shrink: 0;
}
/* modal × overlaps the header's right edge — leave room for it */
.mr-panel:not(.mr-panel-popup) .mr-header { padding-right: 48px; }
.mr-brand-logo {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px var(--mr-accent-glow);
  flex-shrink: 0;
  transition: box-shadow .15s, transform .12s;
}
.mr-brand-logo:hover { transform: translateY(-1px); box-shadow: 0 6px 16px var(--mr-accent-glow); }
.mr-brand-logo:active { transform: scale(.94); }
.mr-brand-text { font-size: 15px; font-weight: 800; color: var(--mr-text); letter-spacing: -.3px; white-space: nowrap; }
.mr-count-pill {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .3px;
  color: var(--mr-accent);
  background: var(--mr-accent-tint);
  border: 1px solid var(--mr-accent-edge);
  border-radius: 999px;
  padding: 3px 9px;
  white-space: nowrap;
}
/* ── Scroll area ── */
.mr-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mr-body::-webkit-scrollbar { width: 6px; }
.mr-body::-webkit-scrollbar-track { background: transparent; }
.mr-body::-webkit-scrollbar-thumb { background: var(--mr-scrollbar); border-radius: 3px; }

/* ── Filters ── */
.mr-filters {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mr-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  color: var(--mr-accent);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 10px;
}

/* Pills (loaders, categories) */
.mr-pills { display: flex; flex-wrap: wrap; gap: 7px; }
.mr-pill {
  appearance: none;
  border: 1px solid var(--mr-surface-border);
  background: var(--mr-surface);
  color: var(--mr-text-dim);
  border-radius: 999px;
  padding: 6px 13px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background .12s, color .12s, border-color .12s;
}
.mr-pill:hover { border-color: var(--mr-accent-edge); color: var(--mr-text); }
.mr-pill.is-selected {
  border: 1px solid transparent;
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  color: var(--mr-accent-fg);
  font-weight: 700;
  box-shadow: 0 2px 10px var(--mr-accent-glow);
}
.mr-pill.is-selected:hover { color: var(--mr-accent-fg); }

/* Match any/all pill segment */
.mr-match-wrap {
  display: flex; align-items: center; gap: 6px;
  text-transform: none; letter-spacing: 0;
}
.mr-match-hint { color: var(--mr-text-faint); font-size: 11px; font-weight: 500; }
.mr-match {
  display: flex;
  background: var(--mr-surface);
  border: 1px solid var(--mr-surface-border);
  border-radius: 999px;
  padding: 2px;
}
.mr-match-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  padding: 2px 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.mr-match-btn.is-active {
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  color: var(--mr-accent-fg);
  font-weight: 700;
}

/* Version range */
.mr-version-range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: end;
}
.mr-version-cap {
  font-size: 10px;
  color: var(--mr-text-faint);
  margin-bottom: 5px;
  letter-spacing: 0.3px;
}
.mr-version-arrow { color: var(--mr-accent); padding-bottom: 10px; text-align: center; font-weight: 700; }
.mr-select {
  width: 100%;
  background: var(--mr-surface);
  border: 1px solid var(--mr-surface-border);
  border-radius: 10px;
  padding: 9px 28px 9px 11px;
  color: var(--mr-text);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  background-image: var(--mr-chevron);
  background-repeat: no-repeat;
  background-position: right 11px center;
  background-size: 10px 10px;
  transition: border-color .12s;
}
.mr-select:hover, .mr-select:focus { border-color: var(--mr-accent-edge); outline: none; }
.mr-select option { background: var(--mr-surface); color: var(--mr-text); }

/* Segmented control (Side) */
.mr-segmented {
  display: flex;
  background: var(--mr-surface);
  border: 1px solid var(--mr-surface-border);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}
.mr-seg-btn {
  flex: 1;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background .12s, color .12s;
}
.mr-seg-btn.is-active {
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  color: var(--mr-accent-fg);
  font-weight: 700;
}

/* Min downloads + Reset row */
.mr-section-row { display: flex; align-items: flex-end; gap: 12px; }
.mr-section-row > div { flex: 1; min-width: 0; }
.mr-num-input {
  width: 100%;
  background: var(--mr-surface);
  border: 1px solid var(--mr-surface-border);
  border-radius: 10px;
  padding: 9px 11px;
  color: var(--mr-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color .12s, box-shadow .12s;
}
.mr-num-input:focus { border-color: var(--mr-accent); box-shadow: 0 0 0 3px var(--mr-accent-glow); }
.mr-reset-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--mr-text-dim);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 9px 4px;
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: color .12s;
}
.mr-reset-btn:hover { color: var(--mr-accent); font-weight: 600; }

/* ── Footer (filters CTA) ── */
.mr-footer {
  padding: 13px 16px 15px;
  border-top: 1px solid var(--mr-divider);
  background: var(--mr-bg);
  flex-shrink: 0;
}

/* ── Loading (centered dice) ── */
.mr-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
}
.mr-loading-dice {
  width: 78px;
  height: 78px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 38px var(--mr-accent-glow);
  animation: rm-dice 1.2s ease-in-out infinite;
  transform-origin: 50% 50%;
}
.mr-loading-text {
  font-size: 14px;
  color: var(--mr-text-strong);
  font-weight: 600;
  animation: rm-pulse 1.4s ease-in-out infinite;
}

/* ── Buttons ── */
.mr-btn {
  appearance: none;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  transition: box-shadow .15s, transform .12s, background .12s;
}
.mr-btn-primary {
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  color: var(--mr-accent-fg);
  padding: 14px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -.2px;
  box-shadow: 0 6px 20px var(--mr-accent-glow);
}
.mr-btn-primary:hover { box-shadow: 0 9px 28px var(--mr-accent-glow); transform: translateY(-1px); }
.mr-btn-secondary {
  background: var(--mr-surface);
  border: 1px solid var(--mr-surface-border);
  color: var(--mr-text);
  padding: 13px 16px;
  font-size: 13.5px;
  font-weight: 700;
  width: auto;
  border-radius: 11px;
  gap: 6px;
}
.mr-btn-secondary:hover { background: var(--mr-accent-tint); border-color: var(--mr-accent-edge); }

/* ── Summary bar (result state) ── */
.mr-summary-bar {
  margin: 14px 14px 0;
  text-align: left;
  background: var(--mr-surface);
  border: 1px solid var(--mr-border);
  border-radius: 10px;
  padding: 10px 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  font-family: inherit;
  color: var(--mr-text);
  flex-shrink: 0;
  transition: background .12s, border-color .12s;
}
.mr-summary-bar:hover { background: var(--mr-surface-hi); border-color: var(--mr-accent-edge); }
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
  color: var(--mr-accent);
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Result card (hero) ── */
.mr-result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 14px;
}
.mr-mod-card {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--mr-border);
  background: var(--mr-card-bg);
  animation: rm-cardin .35s ease-out;
}
.mr-card-banner {
  position: relative;
  height: 96px;
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  overflow: hidden;
}
.mr-card-banner::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(120px 80px at 80% -10%, rgba(255, 255, 255, 0.30), transparent);
}
.mr-biased-pill {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--mr-accent-fg);
  background: rgba(255, 255, 255, 0.30);
  border: none;
  border-radius: 999px;
  padding: 3px 9px;
  cursor: help;
  font-family: inherit;
}
.mr-card-body { padding: 0 16px 16px; margin-top: -34px; position: relative; }
.mr-mod-icon {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  object-fit: cover;
  background: var(--mr-card-bg);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), inset 0 0 0 2px rgba(255, 255, 255, 0.12);
  border: 3px solid var(--mr-card-bg);
  display: block;
}
.mr-mod-icon-fallback {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3d7a4a 0%, #6bb877 50%, #a8d98f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), inset 0 0 0 2px rgba(255, 255, 255, 0.12);
  border: 3px solid var(--mr-card-bg);
}
.mr-mod-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; margin-top: 10px; }
.mr-mod-title {
  font-size: 21px;
  font-weight: 800;
  color: var(--mr-text);
  letter-spacing: -.5px;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.mr-mod-author { font-size: 12.5px; color: var(--mr-text-dim); margin-top: 3px; }
.mr-mod-author-name { color: var(--mr-text-strong); }
.mr-mod-stats { display: flex; gap: 8px; margin-top: 12px; }
.mr-mod-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--mr-stat-bg);
  border: 1px solid var(--mr-stat-border);
  border-radius: 9px;
  padding: 8px 10px;
}
.mr-mod-stat-val {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 800;
  color: var(--mr-text);
  font-variant-numeric: tabular-nums;
}
.mr-mod-stat-val .mr-ic { color: var(--mr-accent); display: inline-flex; }
.mr-mod-stat-label {
  font-size: 10px;
  color: var(--mr-text-muted);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.mr-mod-desc {
  font-size: 12.5px;
  color: var(--mr-text-strong);
  line-height: 1.55;
  margin-top: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mr-mod-loaders { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.mr-mod-loader-chip {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--mr-accent-fg);
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  border-radius: 6px;
  padding: 3px 8px;
  letter-spacing: 0.2px;
  text-transform: uppercase;
}

/* Result actions row */
.mr-result-actions { display: flex; gap: 8px; margin-top: auto; padding-top: 14px; }
.mr-btn-open {
  flex: 1;
  border: none;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--mr-accent), var(--mr-accent-hi));
  color: var(--mr-accent-fg);
  padding: 13px;
  font-size: 13.5px;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 6px 18px var(--mr-accent-glow);
  transition: box-shadow .15s, transform .12s;
}
.mr-btn-open:hover { box-shadow: 0 9px 26px var(--mr-accent-glow); transform: translateY(-1px); }

/* ── Centered state (empty / error) ── */
.mr-centered {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 28px;
  text-align: center;
  gap: 16px;
}
.mr-centered-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--mr-surface);
  border: 1px solid var(--mr-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
}
.mr-centered.is-danger .mr-centered-icon {
  border-radius: 20px;
  background: var(--mr-danger-tint);
  border-color: var(--mr-danger-edge);
  color: var(--mr-danger);
  font-size: 32px;
}
.mr-centered-title { font-size: 17px; font-weight: 800; color: var(--mr-text); letter-spacing: -.3px; }
.mr-centered-body {
  font-size: 13px;
  color: var(--mr-text-dim);
  margin-top: 7px;
  line-height: 1.5;
  max-width: 260px;
}
.mr-centered-cta { margin-top: 4px; width: 100%; }
.mr-centered-cta .mr-btn-primary { font-size: 14.5px; }
`;
