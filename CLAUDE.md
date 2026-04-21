# Modrinth Random Mod — extension

Chrome MV3 extension that adds a "roll a random Minecraft mod" widget to modrinth.com.

## Architecture at a glance

```
manifest.json             Manifest V3. host_permissions: modrinth.com + api.modrinth.com.
                          content_scripts match https://modrinth.com/*. No background worker.

content.js                Entry on modrinth.com. Injects a header button, wires SPA
                          nav hooks (pushState/popstate + MutationObserver), registers
                          Shift+R hotkey, lazy-creates the modal widget on first open.

popup.html + popup.js     Fallback entry via the extension icon. Loads the same
                          src/*.js and mounts the widget in 'popup' mode (no backdrop,
                          no Shadow DOM, fills the 400×600 popup).

src/utils.js              MRMR.utils: loader slug map, formatCount (K/M), h() hyperscript.
src/storage.js            MRMR.storage: chrome.storage.local 24h tag cache + chrome.storage.sync
                          filters. DEFAULT_FILTERS lives here.
src/api.js                MRMR.api: Modrinth /v2 wrapper. fetchJSON with 429→2s backoff×3.
                          buildFacets / computeVersionsRange / searchRandomMod.
src/widget.css.js         MRMR.css: inlined stylesheet (template literal). Design tokens
                          (--mr-*) and class-based styles for all 5 states.
src/widget.js             MRMR.widget.create(host, {mode}) → {open, close, toggle, destroy}.
                          Renders 5 states into host (Shadow DOM in 'modal' mode).

icons/                    icon16 / icon48 / icon128. Generated via GDI+ — regenerate
                          with the snippet in commit 'feat: initial MV3 skeleton' if
                          you need to change the glyph.

project/                  Claude Design bundle (design intent + prototype). Not committed
                          yet; reference-only. popup.jsx inside is the visual source of
                          truth for the 5 UI states.
```

## Module coupling

Namespace: `window.MRMR` on the content-script isolated world (and on popup's window).
Load order in `manifest.json` and `popup.html`:

```
utils → storage → api → widget.css → widget → (content | popup)
```

Each module `window.MRMR = window.MRMR || {}` idempotently. No ES modules, no bundler.

## UI states (matches design/popup.jsx)

| State    | Trigger                                  | Footer                |
|----------|------------------------------------------|-----------------------|
| filters  | Initial / "Adjust filters"               | 🎲 Random Mod CTA     |
| loading  | Roll in progress                         | spinner + status text |
| result   | Successful `searchRandomMod`             | — (inline action row) |
| empty    | `total_hits === 0` or min-DL exhausted   | — (centered)          |
| error    | Network / non-2xx                        | — (centered, danger)  |

Close paths for the modal: backdrop click, Escape, × button. All three → `widget.close()`.

## Roll algorithm

1. Build facets: outer AND, inner OR.
   - `project_type:mod` always.
   - Loaders → `categories:<slug>` group (yes, loaders live in the `categories` facet in v2).
   - Version range from `/v2/tag/game_version` (only `version_type: "release"`),
     sliced between `from` and `to` inclusive. Autoswap if user picked them in reverse.
   - Categories → one OR group (match=any) or one AND per item (match=all).
   - Side → OR of `{required, optional}` for chosen side. Skipped when `Any`.
2. First request with `limit=1, offset=0` → read `total_hits`.
3. Cap at 10 000 (Modrinth API limit). Pick `offset = randInt(min(total, 10000))`.
4. Second request → `hits[0]`.
5. If `minDownloads > 0`, reroll up to 5 times until a hit meets the threshold.
6. When `total_hits > 10000`, return `biased: true` → UI shows `?` badge next to title.

## SPA handling

Modrinth is Nuxt. Route changes use `history.pushState` without reload, and Vue may
rebuild arbitrary DOM on mount. Two paths in `content.js`:

- `history.pushState` / `replaceState` / `popstate` → `requestAnimationFrame` → `reinject()`. Fast.
- `MutationObserver` on `document.body` → trailing debounce 250ms → `reinject()`. Catches re-renders that don't go through the history API.

`reinject()` is a no-op when the button is already present — safe to call repeatedly.

## Mobile / viewport fallback

Modrinth's desktop header uses `.desktop-only` (hidden below 1024px). Our injection
selector intentionally includes `.desktop-only`, so on mobile we simply don't inject.
Hotkey Shift+R is also gated on `innerWidth >= 1024`. The user reaches the widget
via the extension icon → popup → same `createWidget(host, {mode:'popup'})`.

## Storage layout

```
chrome.storage.sync {
  filters: { loaders[], versionFrom, versionTo, categories[], match, side, minDownloads }
}
chrome.storage.local {
  'cache:gameVersions': { ts, v: GameVersion[] }
  'cache:categories':   { ts, v: string[] }   // only project_type === 'mod'
}
```

TTL 24h for the cache. Misses fall through to the API.

## Conventions for future edits

- **No bundler.** Don't introduce webpack / vite / rollup. Keep classic scripts + namespace.
- **No framework.** Vanilla DOM via `MRMR.utils.h()`. No React/Vue/Svelte.
- **No `User-Agent` header in `fetch`.** MV3 forbids it; Chrome silently strips.
- **Shadow DOM in modal mode only.** Popup doesn't need isolation (it owns its frame).
- **Commits:** Conventional, English, NO `Co-Authored-By: Claude`, NEVER `git add .`.
  Always enumerate files explicitly.
- **Git-ignored:** `.claude/`, `node_modules/`, `*.zip`. `project/` (design bundle) is
  deliberately untracked — treat as reference, not code.
- **Out of scope** (don't add without a new task): roll history, favourites,
  shaders / resource packs / modpacks, automated tests, background service worker.

## Smoke test after any change

1. `chrome://extensions` → Developer mode → Load unpacked → project root.
2. Open `https://modrinth.com/` — dice button appears between "Войти" and ⚙.
3. Click it → modal opens centered with backdrop.
4. Shift+R (outside inputs) → modal opens.
5. Escape / backdrop click / × → modal closes.
6. Roll with defaults → real mod card appears.
7. DevTools → Offline → Roll → error state; uncheck Offline + Retry → works.
8. Refresh page → filters survive (storage.sync).
9. Navigate between / → /mods → /mod/<slug> → dice button stays, no duplicates.
10. Open the extension popup icon → same UI fills the 400×600 popup.
