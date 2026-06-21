# Random Mod — extension

Chrome MV3 extension that adds a "roll a random Minecraft mod" widget to **modrinth.com
and curseforge.com**. The same widget runs on both sites and auto-recolors by host
(Modrinth → green, CurseForge → orange).

## Architecture at a glance

```
manifest.json             Manifest V3. version 0.2.0 (+ version_name "0.2.0-alpha").
                          host_permissions: modrinth.com + api.modrinth.com + *://*.curseforge.com/*.
                          content_scripts match https://modrinth.com/* AND *://*.curseforge.com/*.
                          No background worker (popup talks to the content script directly).

content.js                Entry on BOTH sites. Mounts a body-level fixed floating dice
                          button inside its OWN Shadow DOM host (NOT in the site's
                          framework-managed DOM — that broke Nuxt hydration, and CF's
                          global CSS leaks onto bare nodes). Colors the button + picks a
                          per-site top offset by detected site. Registers Shift+R, lazy-
                          creates the modal widget, and (on CF) answers the popup's
                          MRMR_CF_* messages with same-origin fetches.

popup.html + popup.js     Fallback entry via the extension icon. Loads the same src/*.js,
                          resolves the active tab's site, mounts the widget in 'popup'
                          mode (no backdrop, no Shadow DOM, fills the 400×600 popup).

src/site.js               MRMR.site.detect() → 'modrinth' | 'curseforge' from hostname.
                          Popup resolves the site from the active tab's URL (host perms,
                          no extra "tabs" permission); fallback 'modrinth'.
src/utils.js              MRMR.utils: loader slug map, formatCount (K/M), randInt, h() hyperscript.
src/storage.js            MRMR.storage: chrome.storage.local 24h tag cache + chrome.storage.sync
                          filters (stored per-site). DEFAULT_FILTERS lives here.
src/api.js                MRMR.api: Modrinth /v2 wrapper + CurseForge SSR layer. Dispatches
                          getGameVersions(site) / getCategories(site) / searchRandomMod(filters, site).
src/widget.css.js         MRMR.css: inlined stylesheet (template literal). Concept C neutrals +
                          ONE swappable accent token group (--mr-accent*) + class-based styles
                          for all 5 states.
src/widget.js             MRMR.widget.create(host, {mode, site}) → {open, close, toggle, destroy}.
                          Renders 5 states; site drives accent class, labels, loader list,
                          category source, and hides Side on CF.

icons/                    icon16 / icon48 / icon128. Generated via GDI+ — regenerate
                          with the snippet in commit 'feat: initial MV3 skeleton'.

reference/                Approved Concept C ("Expressive") design export — the visual
                          source of truth (reference/Random Mod - Expressive.dc.html).
                          Untracked, reference-only (Claude Design .dc.html templating).
project/                  Older Claude Design bundle (the pre-Concept-C green popup).
                          Untracked, reference-only.
```

## Module coupling

Namespace: `window.MRMR` on the content-script isolated world (and on popup's window).
Load order in `manifest.json` and `popup.html`:

```
site → utils → storage → api → widget.css → widget → (content | popup)
```

Each module `window.MRMR = window.MRMR || {}` idempotently. No ES modules, no bundler.

## Site detection & theming

- `MRMR.site.detect()` returns the host. The widget sets `mr-site-<site>` on its root.
- Accent is ONE swappable token group in `widget.css.js`: `--mr-accent / -hi / -fg /
  -tint / -edge / -glow` (+ `--mr-chevron`, since a data-URI can't read a CSS var).
  `.mr-root.mr-site-modrinth` = green, `.mr-root.mr-site-curseforge` = orange. No accent
  hex anywhere in component styles.
- Site-dependent **text** swaps by label, not color: "Open on Modrinth/CurseForge",
  error title "… is unreachable". The floating button (`content.js`) colors itself by site.
- Visual is the approved **Concept C** (Expressive): gradient logo cube (doubles as the
  glow toggle), header filter-count pill, accent section labels, gradient-selected pills/
  segments with glow, hero result card (banner + stat blocks + loader chips + "biased ?"
  pill). Animations: rm-pop / rm-dice / rm-roll / rm-pulse / rm-cardin / rm-spin.

## UI states

| State    | Trigger                                   | Footer                |
|----------|-------------------------------------------|-----------------------|
| filters  | Initial / "Adjust filters"                | 🎲 Random Mod CTA     |
| loading  | Roll in progress                          | — (centered dice)     |
| result   | Successful `searchRandomMod`              | — (inline action row) |
| empty    | no results / min-DL exhausted             | — (centered)          |
| error    | network / non-2xx / CF markup changed     | — (centered, danger)  |

Close paths for the modal: backdrop click, Escape, × button. All three → `widget.close()`.

## Roll algorithm — Modrinth (`searchRandomModModrinth`, /v2)

1. Build facets: outer AND, inner OR.
   - `project_type:mod` always.
   - Loaders → `categories:<slug>` group (loaders live in the `categories` facet in v2).
   - Version range from `/v2/tag/game_version` (only `version_type: "release"`),
     sliced between `from` and `to` inclusive. Autoswap if picked in reverse.
   - Categories → one OR group (match=any) or one AND per item (match=all).
   - Side → OR of `{required, optional}` for chosen side. Skipped when `Any`.
2. Versions-facet guard (`MAX_FACET_TERMS = 45`). Modrinth returns `total_hits:0` once the
   facets filter carries ~50+ terms (49 OK, 55 → 0). Drop the `versions` group when it
   spans every release (= "any version") or would exceed the cap; in the latter case keep
   the range as a client-side filter and reroll (up to `VERSION_FILTER_MAX_TRIES = 12`).
3. First request `limit=1, offset=0` → `total_hits`.
4. Cap at 10 000. Pick `offset = randInt(min(total, 10000))` → second request → `hits[0]`.
5. `minDownloads > 0` → reroll up to 5×. `total_hits > 10000` → `biased: true`.

## Roll algorithm — CurseForge (`searchRandomModCF`, SSR)

CurseForge's `/api/v1/*` JSON endpoints return **403 (Cloudflare)** and the official
`api.curseforge.com` needs a key that can't ship in a public extension (ToS §2.2). So the
CF layer fetches the same **`/minecraft/search` HTML** the site itself serves (200 in a
real, cookie'd session — works same-origin from the content script) and parses it.

- URL params (observed live): `class=mc-mods`, `pageSize=20`, `sortBy=totalDownloads`,
  `page=N`; filters applied **server-side**: `gameVersionTypeId` (loaders → 1 Forge / 4
  Fabric / 5 Quilt / 6 NeoForge, comma-sep), `version=<v1,v2,…>` (range expanded to CF
  version strings), `categories=<slug,…>`.
- Parse `.project-card` → name / slug (`a.name` href) / author / `.detail-downloads`
  (e.g. "367.3M") / `.description` / `.detail-game-version` / `.detail-flavor` (loader) /
  `.art img` (icon). CF has no "follows" → 0.
- Random page: total from the "N Projects" count → `pages = min(ceil(count/20), 500)`
  (CF hard-caps the pager at 500). Pick a random page, then a random card. `minDownloads`
  is a **client-side** filter; since results are sorted by downloads desc, a page with
  cards but none qualifying shrinks the upper bound (converges past the low-DL tail).
  `biased: true` when the count is "10,000+" or pages hit the 500 cap.
- **Soft fallback:** 200 with results expected but no `.project-card` parsed (CF changed
  markup) → log `[MRMR/cf]` + throw → error state. Never fail silently.
- Diagnostics: `CF_DEBUG` logs `[MRMR/cf]` lines (Modrinth path stays silent).

## Popup transport (CurseForge)

The popup runs on `chrome-extension://` — cross-origin to CF and behind Cloudflare. So in
popup context `MRMR.api` routes CF calls (`searchRandomMod` / `getCategories` /
`getGameVersions`) via `chrome.tabs.sendMessage` to the active CF tab, whose `content.js`
runs the same-origin fetch and replies (`MRMR_CF_SEARCH` / `MRMR_CF_CATEGORIES` /
`MRMR_CF_VERSIONS`). Modrinth from the popup stays a direct fetch (its API sends
permissive CORS). No active CF tab → CF rolls are unavailable (Modrinth still works).

## SPA handling

Both sites are SPAs (Modrinth = Nuxt, CurseForge = Next). An earlier version injected the
button INTO Modrinth's header (Vue-managed DOM); that corrupted hydration and crashed the
page into `Error 500` (`$_detachPopperNode` → `parentNode`). The fix: never touch the
framework's DOM. The button lives in a body-level fixed host (`#mrmr-btn-host`) **with its
own Shadow DOM**, outside the framework root, so neither framework patching nor the site's
global CSS (CF forces `min-width:1272px` on bare divs) can affect it.

`content.js` keeps one `MutationObserver` on `document.body` (direct children only, no
subtree) as a safety net: if something removes our host, recreate it. It never reads or
writes the site's DOM.

## Mobile / viewport fallback

The floating button is gated on `innerWidth >= 1024` (created on load, shown/hidden on
`resize`); on mobile it isn't mounted. Shift+R is gated the same way. The user reaches the
widget via the extension icon → popup → same `create(host, {mode:'popup', site})`.

## Storage layout

```
chrome.storage.sync {
  // The ENTIRE filter set is kept per site, behind one access layer:
  // getFilters(site) / setFilters(site, f). Nothing one site sets bleeds to the other.
  filters: {
    modrinth:   { loaders[], versionFrom, versionTo, categories[], match, side, minDownloads },
    curseforge: { loaders[], versionFrom, versionTo, categories[], match, side, minDownloads }
  }
  // `categories[]` holds site-native slugs (Modrinth vs CF taxonomy). `side` is
  // Modrinth-only (hidden/ignored on CF). A one-time migration seeds both sites
  // from the old flat shape (Modrinth keeps `categories`, CF takes `cfCategories`).
}
chrome.storage.local {                            // 24h TTL; misses fall through to source
  'cache:gameVersions'    : { ts, v: GameVersion[] }          // Modrinth /v2 tags
  'cache:modCategories'   : { ts, v: {value,label}[] }        // Modrinth, project_type==='mod'
  'cache:cf:gameVersions' : { ts, v: {version,version_type}[] } // CF sidebar, newest-first
  'cache:cf:categories'   : { ts, v: {value:slug,label}[] }     // CF top-level only
}
```

## Per-site filter differences

Every filter is stored independently per site (see Storage layout). The widget loads the
active site's object, so reads are a plain `filters.<key>` with no per-key site branching;
the only site-specific bits are the UI ones below.

- **Loaders:** Modrinth shows the full set (9); CF shows only Forge/Fabric/NeoForge/Quilt.
- **Categories:** different taxonomies — Modrinth slugs vs CF top-level slugs (parsed from
  the sidebar, e.g. "API and Library" → `library-api`).
- **Versions:** Modrinth `/v2/tag/game_version` vs CF's own sidebar version list.
- **Side:** Modrinth only — the Side section is **hidden on CF** (CF search has no
  client/server facet).

## Conventions for future edits

- **No bundler.** Classic scripts + namespace. **No framework.** Vanilla DOM via `h()`.
- **One accent token group**, swapped by site class. Never hardcode an accent hex in styles.
- **No `User-Agent` header in `fetch`.** MV3 forbids it; Chrome silently strips.
- **Shadow DOM** for the modal AND the floating button host (isolation from site CSS).
  Popup doesn't need it (it owns its frame).
- **CurseForge selectors are scraped from SSR HTML** — if CF changes its markup, update
  the `.project-card` / sidebar parsers in `api.js`; the soft fallback surfaces breakage.
- **Commits:** Conventional, English, NO `Co-Authored-By: Claude`, NEVER `git add .`.
  Always enumerate files explicitly.
- **Git-ignored:** `.claude/`, `node_modules/`, `*.zip`. `project/` + `reference/` are
  deliberately untracked — treat as reference, not code.
- **Out of scope** (don't add without a new task): roll history, favourites, shaders /
  resource packs / modpacks, automated tests, background service worker.

## Smoke test after any change

Load unpacked at `chrome://extensions` → Developer mode → Load unpacked → project root.

**Modrinth (must stay green & fully working):**
1. `https://modrinth.com/` renders normally (NO Error 500); floating dice button top-right.
2. Click / Shift+R → modal opens (Concept C, green). Escape / backdrop / × close.
3. Roll with defaults → real mod card. Wide version range "1.0 → latest" → returns a mod.
4. Offline → "Modrinth is unreachable" + Retry → works. Refresh → filters survive.
5. Navigate / → /mods → /mod/<slug> (incl. SPA clicks) → no Error 500, button persists.
6. Extension popup icon → same UI fills 400×600.

**CurseForge:**
7. `curseforge.com/minecraft/mc-mods` renders normally; dice button present; menu opens
   **orange**, with CF's own categories/versions/4 loaders and **no Side section**.
8. Set loader/version/category/min-downloads → Random Mod → real CF mod; "Open on
   CurseForge" → correct mod page. `[MRMR/cf]` logs show the query + page tries.
9. SPA nav across CF routes → button persists.
10. Popup on an active CF tab → rolls via content-script messaging (orange); other tab →
    green Modrinth fallback.
