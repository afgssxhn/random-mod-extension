window.MRMR = window.MRMR || {};
MRMR.api = (() => {
  const BASE = 'https://api.modrinth.com/v2';
  const OFFSET_CAP = 10000;
  const MIN_DL_MAX_TRIES = 5;
  const VERSION_FILTER_MAX_TRIES = 12;
  // Modrinth's search returns total_hits:0 once the facets filter carries too
  // many terms (empirically: 49 terms still works, 55 → 0 hits). Stay under it.
  // Counts ALL terms (project_type + loaders + versions + categories + side),
  // so a wide version range OR many categories both take the safe path.
  const MAX_FACET_TERMS = 45;

  // ── CurseForge ──
  // The old /api/v1/* JSON endpoints now return 403; the live site is a Next.js
  // SSR app. We fetch the same /minecraft/search HTML the user's browser gets
  // (200 in a real, cookie'd session) and parse the mod cards + filter sidebar.
  // Loaders / version / categories are applied server-side via URL params
  // (observed live on curseforge.com).
  const CF_ORIGIN = 'https://www.curseforge.com';
  const CF_SEARCH = CF_ORIGIN + '/minecraft/search';
  const CF_PAGE_SIZE = 20;
  const CF_MAX_PAGE = 500;    // CF hard-caps the pager at 500 pages (~10k mods)
  const CF_MAX_TRIES = 8;
  // Loader name -> CF gameVersionTypeId (the only 4 CF lists for MC mods).
  const CF_LOADER_TYPE = { Forge: 1, Fabric: 4, Quilt: 5, NeoForge: 6 };
  const CF_LOADERS = ['Forge', 'Fabric', 'NeoForge', 'Quilt'];

  // Diagnostics for the CF layer are ON in the alpha. Modrinth stays silent.
  const CF_DEBUG = true;
  function cfLog(...a) { if (CF_DEBUG) { try { console.debug('[MRMR/cf]', ...a); } catch {} } }

  async function fetchJSON(url, attempt = 0) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.status === 429 && attempt < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return fetchJSON(url, attempt + 1);
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function getGameVersions(site) {
    site = site || (window.MRMR && MRMR.site && MRMR.site.detect()) || 'modrinth';
    if (site === 'curseforge') return getGameVersionsCF();
    const cached = await MRMR.storage.getCached('gameVersions');
    if (cached) return cached;
    const data = await fetchJSON(BASE + '/tag/game_version');
    await MRMR.storage.setCached('gameVersions', data);
    return data;
  }

  // Returns [{ value, label }] for both sites so the widget renders uniformly.
  // Modrinth: value === label === category name (used directly in facets).
  // CurseForge: value = numeric category id (string), label = display name.
  async function getCategories(site) {
    site = site || (window.MRMR && MRMR.site && MRMR.site.detect()) || 'modrinth';
    if (site === 'curseforge') return getCategoriesCF();
    const cached = await MRMR.storage.getCached('modCategories');
    if (cached) return cached;
    const data = await fetchJSON(BASE + '/tag/category');
    const mods = data
      .filter(c => c.project_type === 'mod')
      .map(c => ({ value: c.name, label: c.name }));
    await MRMR.storage.setCached('modCategories', mods);
    return mods;
  }

  function computeVersionsRange(releases, from, to) {
    if (!from && !to) return [];
    if (from && !to) return [from];
    if (!from && to) return [to];
    const iFrom = releases.findIndex(v => v.version === from);
    const iTo = releases.findIndex(v => v.version === to);
    if (iFrom === -1 || iTo === -1) return [];
    // releases are in reverse-chronological order (newest = smaller index)
    // autoswap if user picked from/to in reverse
    const [lo, hi] = iFrom < iTo ? [iFrom, iTo] : [iTo, iFrom];
    return releases.slice(lo, hi + 1).map(v => v.version);
  }

  function buildFacetGroups(filters, versionsRange) {
    const groups = [['project_type:mod']];

    if (filters.loaders && filters.loaders.length) {
      groups.push(filters.loaders.map(l => 'categories:' + MRMR.utils.loaderSlug(l)));
    }

    if (versionsRange && versionsRange.length) {
      groups.push(versionsRange.map(v => 'versions:' + v));
    }

    if (filters.categories && filters.categories.length) {
      if (filters.match === 'all') {
        for (const c of filters.categories) groups.push(['categories:' + c]);
      } else {
        groups.push(filters.categories.map(c => 'categories:' + c));
      }
    }

    if (filters.side === 'Client') {
      groups.push(['client_side:required', 'client_side:optional']);
    } else if (filters.side === 'Server') {
      groups.push(['server_side:required', 'server_side:optional']);
    }

    return groups;
  }

  function buildFacets(filters, versionsRange) {
    return JSON.stringify(buildFacetGroups(filters, versionsRange));
  }

  function countFacetTerms(groups) {
    return groups.reduce((n, g) => n + g.length, 0);
  }

  function hitMatchesVersions(hit, wanted) {
    return Array.isArray(hit.versions) && hit.versions.some(v => wanted.has(v));
  }

  async function searchRandomModModrinth(filters) {
    let versionsRange = [];
    let releases = [];
    if (filters.versionFrom || filters.versionTo) {
      const gv = await getGameVersions();
      releases = gv.filter(v => v.version_type === 'release');
      versionsRange = computeVersionsRange(releases, filters.versionFrom, filters.versionTo);
    }

    // A large `versions` OR group makes Modrinth's search return total_hits:0.
    // Two cases keep it out of the query:
    //   - the range spans every release → it means "any version", just drop it;
    //   - it (with the other facets) would exceed MAX_FACET_TERMS → drop it from
    //     the query and instead filter candidates by version on the client.
    const coversAllReleases = releases.length > 0 && versionsRange.length === releases.length;
    const fitsInFacet =
      versionsRange.length > 0 &&
      !coversAllReleases &&
      countFacetTerms(buildFacetGroups(filters, versionsRange)) <= MAX_FACET_TERMS;

    const facetVersions = fitsInFacet ? versionsRange : [];
    // Client-side version filter: only when we had a real range but didn't (or
    // couldn't) put it in the query — never for the "any version" full range.
    const wantedVersions =
      versionsRange.length > 0 && !fitsInFacet && !coversAllReleases
        ? new Set(versionsRange)
        : null;

    const facets = buildFacets(filters, facetVersions);
    const qs = 'facets=' + encodeURIComponent(facets) + '&limit=1';

    const first = await fetchJSON(BASE + '/search?' + qs + '&offset=0');
    if (first.total_hits === 0) return { empty: true };

    const capped = Math.min(first.total_hits, OFFSET_CAP);
    const minDL = Number(filters.minDownloads) || 0;
    const maxTries = wantedVersions
      ? VERSION_FILTER_MAX_TRIES
      : (minDL > 0 ? MIN_DL_MAX_TRIES : 1);

    for (let i = 0; i < maxTries; i++) {
      const offset = MRMR.utils.randInt(capped);
      const res = await fetchJSON(BASE + '/search?' + qs + '&offset=' + offset);
      const hit = res.hits && res.hits[0];
      if (!hit) continue;
      if (minDL > 0 && hit.downloads < minDL) continue;
      if (wantedVersions && !hitMatchesVersions(hit, wantedVersions)) continue;
      return { mod: hit, biased: first.total_hits > OFFSET_CAP };
    }
    return { empty: true, reason: wantedVersions ? 'version_filter' : 'min_downloads' };
  }

  // ── CurseForge data layer ───────────────────────────────────
  // True when this code runs on a curseforge.com page (content script /
  // injected modal) → same-origin fetch works. False in the popup
  // (chrome-extension://) → route through the active CF tab's content script.
  function onCFPage() {
    return typeof location !== 'undefined' && /(^|\.)curseforge\.com$/i.test(location.hostname);
  }

  // Fetch a CurseForge page → Document. Plain HTML passes Cloudflare in a real
  // session (the /api/v1 JSON endpoints return 403).
  async function cfFetchDoc(url) {
    cfLog('GET', url.replace(CF_ORIGIN, ''));
    const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'text/html' } });
    if (!res.ok) { cfLog('HTTP', res.status); throw new Error('CurseForge HTTP ' + res.status); }
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }

  // "367.3M" / "10.5K" / "842" -> number
  function cfParseCount(s) {
    const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB]?)/i);
    if (!m) return 0;
    const mult = { '': 1, K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
    return Math.round((parseFloat(m[1]) || 0) * mult);
  }

  function cfText(el, sel) {
    const e = el.querySelector(sel);
    return e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  // Build the CF search URL. Loaders / version range / categories are applied
  // server-side via the exact params CF itself uses (observed live).
  function cfSearchUrl(filters, page, cfReleases) {
    const p = new URLSearchParams();
    p.set('class', 'mc-mods');
    p.set('pageSize', String(CF_PAGE_SIZE));
    p.set('sortBy', 'totalDownloads');
    if (page > 1) p.set('page', String(page));
    if (filters.loaders && filters.loaders.length) {
      const ids = filters.loaders.map(l => CF_LOADER_TYPE[l]).filter(Boolean);
      if (ids.length) p.set('gameVersionTypeId', ids.join(','));
    }
    if (filters.versionFrom || filters.versionTo) {
      const range = computeVersionsRange(cfReleases || [], filters.versionFrom, filters.versionTo);
      // Drop it when it spans every release (== "any version").
      if (range.length && range.length < (cfReleases || []).length) p.set('version', range.join(','));
    }
    if (filters.cfCategories && filters.cfCategories.length) {
      p.set('categories', filters.cfCategories.join(','));
    }
    return CF_SEARCH + '?' + p.toString();
  }

  function cfParseCards(doc) {
    return [...doc.querySelectorAll('.project-card')].map(card => {
      const nameA = card.querySelector('a.name');
      const href = (nameA && nameA.getAttribute('href')) || '';
      const slug = (href.match(/\/minecraft\/mc-mods\/([^/?#]+)/) || [])[1] || '';
      const flavor = cfText(card, '.detail-flavor');
      const img = card.querySelector('.art img');
      const title = (nameA && (nameA.getAttribute('title') || '')
        .replace(/^Go to /, '').replace(/ Project Page$/, '')) || cfText(card, 'a.name');
      return {
        title: title || 'Untitled',
        slug,
        author: cfText(card, '.author-name a') || cfText(card, '.author-name'),
        downloads: cfParseCount(cfText(card, '.detail-downloads')),
        follows: 0,
        description: cfText(card, '.description'),
        version: cfText(card, '.detail-game-version'),
        loaders: flavor ? [flavor] : [],
        icon_url: (img && img.getAttribute('src')) || null,
        url: slug ? (CF_ORIGIN + '/minecraft/mc-mods/' + slug) : (CF_ORIGIN + href)
      };
    }).filter(m => m.slug);
  }

  function cfTotalPages(doc) {
    const nums = [];
    doc.querySelectorAll('.page-numbers').forEach(el => {
      const n = parseInt((el.textContent || '').trim(), 10);
      if (Number.isFinite(n)) nums.push(n);
      el.querySelectorAll('*').forEach(c => {
        const k = parseInt((c.textContent || '').trim(), 10);
        if (Number.isFinite(k)) nums.push(k);
      });
    });
    if (!nums.length) {
      const m = (doc.body.textContent || '').match(/\bof\s+([\d,]+)/);
      if (m) nums.push(parseInt(m[1].replace(/,/g, ''), 10));
    }
    return nums.length ? Math.min(Math.max(...nums), CF_MAX_PAGE) : 1;
  }

  // { count, plus } from "10,000+ Projects" / "1,234 Projects", else null.
  function cfTotalCount(doc) {
    const el = [...doc.querySelectorAll('*')].find(e => e.childElementCount === 0 && /Projects/i.test(e.textContent));
    const m = el && el.textContent.replace(/\s+/g, ' ').match(/([\d,]+)\s*(\+?)\s*Projects/i);
    return m ? { count: parseInt(m[1].replace(/,/g, ''), 10), plus: m[2] === '+' } : null;
  }

  // Filter sidebar -> { categories:[{value:slug,label}] (top-level only),
  //                     versions:[{version, version_type}] (newest first) }
  function cfParsePanel(doc) {
    const catLinks = [...doc.querySelectorAll('a[href*="categories="]')].map(a => {
      const raw = ((a.getAttribute('href') || '').match(/[?&]categories=([^&]+)/) || [])[1];
      const lab = a.querySelector('[title]');
      const label = lab ? (lab.getAttribute('title') || '').trim()
        : (a.textContent || '').replace(/\s+/g, ' ').trim();
      let depth = 0, p = a.parentElement;
      while (p) { if (p.tagName === 'UL') depth++; p = p.parentElement; }
      return { value: raw ? decodeURIComponent(raw).split(',').pop() : '', label, depth };
    }).filter(c => c.value && c.label);
    const minDepth = catLinks.length ? Math.min(...catLinks.map(c => c.depth)) : 0;
    const catSeen = new Set();
    const categories = [];
    for (const c of catLinks) {
      if (c.depth !== minDepth || catSeen.has(c.value)) continue;
      catSeen.add(c.value);
      categories.push({ value: c.value, label: c.label });
    }

    const verSeen = new Set();
    const versions = [];
    for (const a of doc.querySelectorAll('a[href*="version="]')) {
      const raw = ((a.getAttribute('href') || '').match(/[?&]version=([^&]+)/) || [])[1];
      const ver = raw ? decodeURIComponent(raw).split(',').pop() : '';
      if (/^\d/.test(ver) && !verSeen.has(ver)) { verSeen.add(ver); versions.push({ version: ver, version_type: 'release' }); }
    }
    return { categories, versions };
  }

  // Popup → active CurseForge tab's content script (same-origin fetch there).
  async function cfViaActiveTab(message) {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      throw new Error('Open a CurseForge tab to roll');
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    let host = '';
    try { host = tab && tab.url ? new URL(tab.url).hostname : ''; } catch {}
    if (!tab || !host.includes('curseforge.com')) {
      const e = new Error('Open a CurseForge tab to roll'); e.cfNoTab = true; throw e;
    }
    const resp = await chrome.tabs.sendMessage(tab.id, message);
    if (!resp) throw new Error('No response from the CurseForge tab');
    if (resp.error) throw new Error(resp.error);
    return resp.result;
  }

  // Fetch + parse the filter sidebar once; cache categories + versions per-site.
  async function cfPanel() {
    const doc = await cfFetchDoc(CF_SEARCH + '?class=mc-mods&pageSize=' + CF_PAGE_SIZE);
    const { categories, versions } = cfParsePanel(doc);
    cfLog('panel: categories', categories.length, 'versions', versions.length);
    await MRMR.storage.setCached('cf:categories', categories);
    await MRMR.storage.setCached('cf:gameVersions', versions);
    return { categories, versions };
  }

  async function getCategoriesCF() {
    if (!onCFPage()) {
      try { return await cfViaActiveTab({ type: 'MRMR_CF_CATEGORIES' }); } catch { return []; }
    }
    const cached = await MRMR.storage.getCached('cf:categories');
    if (cached) return cached;
    return (await cfPanel()).categories;
  }

  async function getGameVersionsCF() {
    if (!onCFPage()) {
      try { return await cfViaActiveTab({ type: 'MRMR_CF_VERSIONS' }); } catch { return []; }
    }
    const cached = await MRMR.storage.getCached('cf:gameVersions');
    if (cached) return cached;
    return (await cfPanel()).versions;
  }

  // Random CF mod: pick a random results page (loader/version/categories already
  // applied server-side), pick a random card, client-filter by min downloads.
  async function searchRandomModCF(filters) {
    let cfReleases = [];
    if (filters.versionFrom || filters.versionTo) {
      try { cfReleases = await getGameVersionsCF(); } catch { cfReleases = []; }
    }
    const minDL = Number(filters.minDownloads) || 0;

    const first = await cfFetchDoc(cfSearchUrl(filters, 1, cfReleases));
    const firstCards = cfParseCards(first);
    const total = cfTotalCount(first);
    if (!firstCards.length) {
      if (total && total.count === 0) return { empty: true };
      // 200 but nothing parsed where results were expected → markup changed.
      cfLog('no .project-card parsed — CF layout may have changed');
      throw new Error('CurseForge layout not recognized');
    }
    // Prefer the "N Projects" count (exact) over the pager's max number, then
    // cap at CF's 500-page limit. Avoids rolling pages past the real results.
    let totalPages = cfTotalPages(first);
    if (total && total.count) totalPages = Math.min(Math.ceil(total.count / CF_PAGE_SIZE), CF_MAX_PAGE);
    totalPages = Math.max(1, totalPages);
    const biased = (total && total.plus) || totalPages >= CF_MAX_PAGE;

    const pickFrom = (cards) => {
      const good = minDL > 0 ? cards.filter(m => m.downloads >= minDL) : cards;
      return good.length ? good[MRMR.utils.randInt(good.length)] : null;
    };

    // Results are sorted by downloads desc. A page with cards but none meeting
    // minDownloads (or a page past the last result) means every later page
    // misses too — so shrink the upper bound to converge on the live region.
    let hi = totalPages;
    let chosen = null;
    for (let i = 0; i < CF_MAX_TRIES && hi >= 1 && !chosen; i++) {
      const page = 1 + MRMR.utils.randInt(hi);
      const cards = page === 1 ? firstCards
        : cfParseCards(await cfFetchDoc(cfSearchUrl(filters, page, cfReleases)));
      cfLog('try', i, 'page', page, '/', totalPages, 'cards', cards.length);
      chosen = pickFrom(cards);
      if (!chosen && (cards.length === 0 || minDL > 0)) hi = Math.min(hi, page - 1);
    }
    if (chosen) return { mod: chosen, biased };
    return { empty: true, reason: minDL > 0 ? 'cf_min_downloads' : 'cf_empty' };
  }

  // ── Dispatcher: Modrinth direct; CurseForge same-origin or via tab ──
  async function searchRandomMod(filters, site) {
    site = site || (window.MRMR && MRMR.site && MRMR.site.detect()) || 'modrinth';
    if (site === 'curseforge') {
      if (onCFPage()) return searchRandomModCF(filters);
      return cfViaActiveTab({ type: 'MRMR_CF_SEARCH', filters });
    }
    return searchRandomModModrinth(filters);
  }

  return {
    getGameVersions,
    getCategories,
    searchRandomMod,
    buildFacets,
    computeVersionsRange,
    OFFSET_CAP,
    CF_LOADERS
  };
})();
