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

  // ── CurseForge (internal site API, same-origin from the content script) ──
  const CF_SEARCH = 'https://www.curseforge.com/api/v1/mods/search';
  const CF_CATEGORIES = 'https://www.curseforge.com/api/v1/categories';
  const CF_GAME_ID = 432;     // Minecraft
  const CF_CLASS_ID = 6;      // Mods
  const CF_SORT_DOWNLOADS = 6;
  const CF_PAGE_SIZE = 50;
  const CF_MAX_TRIES = 10;
  // CurseForge modLoaderType enum <-> our loader names.
  const CF_LOADER = { Forge: 1, LiteLoader: 3, Fabric: 4, Quilt: 5, NeoForge: 6 };
  const CF_LOADER_NAME = { 1: 'Forge', 2: 'Cauldron', 3: 'LiteLoader', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };

  // Diagnostics for the CF layer are ON in the alpha (per project decision)
  // while the undocumented endpoint stabilizes. Modrinth stays silent.
  const CF_DEBUG = true;
  function cfLog(...a) { if (CF_DEBUG) { try { console.debug('[MRMR/cf]', ...a); } catch {} } }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function fetchJSON(url, attempt = 0) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.status === 429 && attempt < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return fetchJSON(url, attempt + 1);
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function getGameVersions() {
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

  async function cfFetch(url, attempt = 0) {
    cfLog('GET', url);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
    if (res.status === 429 && attempt < 2) { await sleep(2000); return cfFetch(url, attempt + 1); }
    if (!res.ok) { cfLog('HTTP', res.status); throw new Error('HTTP ' + res.status); }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      // Cloudflare challenge / HTML instead of JSON.
      cfLog('non-JSON response (Cloudflare?)', ct);
      throw new Error('CurseForge blocked the request');
    }
    return res.json();
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

  async function getCategoriesCF() {
    if (!onCFPage()) {
      // Popup: ask the active CF tab; if there is none, just no categories.
      try { return await cfViaActiveTab({ type: 'MRMR_CF_CATEGORIES' }); }
      catch { return []; }
    }
    const cached = await MRMR.storage.getCached('cfCategories');
    if (cached) return cached;
    const json = await cfFetch(CF_CATEGORIES + '?gameId=' + CF_GAME_ID + '&classId=' + CF_CLASS_ID);
    const list = Array.isArray(json) ? json : (json.data || []);
    const cats = list
      .filter(c => c && c.name != null && c.id != null)
      .map(c => ({ value: String(c.id), label: c.name, slug: c.slug }));
    cfLog('categories', cats.length);
    await MRMR.storage.setCached('cfCategories', cats);
    return cats;
  }

  function mapCFMod(mod) {
    const lfi = Array.isArray(mod.latestFilesIndexes) ? mod.latestFilesIndexes : [];
    const loaders = [...new Set(lfi.map(f => CF_LOADER_NAME[f.modLoader]).filter(Boolean))];
    const url = (mod.links && mod.links.websiteUrl) ||
      ('https://www.curseforge.com/minecraft/mc-mods/' + mod.slug);
    return {
      title: mod.name,
      author: (mod.authors && mod.authors[0] && mod.authors[0].name) || 'unknown',
      downloads: mod.downloadCount || 0,
      follows: mod.thumbsUpCount || 0,   // CF has no "follows"; thumbs-up is the closest
      description: mod.summary || '',
      icon_url: (mod.logo && (mod.logo.thumbnailUrl || mod.logo.url)) || null,
      loaders,
      slug: mod.slug,
      url
    };
  }

  // Parity via client-side filtering + reroll (same idea as the Modrinth
  // version filter): CF search takes one loader / one version per query, so we
  // sample random pages and keep the first candidate matching ALL filters.
  async function searchRandomModCF(filters) {
    const base = CF_SEARCH +
      '?gameId=' + CF_GAME_ID + '&classId=' + CF_CLASS_ID +
      '&sortField=' + CF_SORT_DOWNLOADS + '&sortOrder=desc&pageSize=' + CF_PAGE_SIZE;

    const minDL = Number(filters.minDownloads) || 0;

    let wantLoaders = null;
    if (filters.loaders && filters.loaders.length) {
      const ids = filters.loaders.map(l => CF_LOADER[l]).filter(Boolean);
      if (!ids.length) return { empty: true, reason: 'cf_loader' };
      wantLoaders = new Set(ids);
    }

    let wantVersions = null;
    if (filters.versionFrom || filters.versionTo) {
      const gv = await getGameVersions();
      const releases = gv.filter(v => v.version_type === 'release');
      const range = computeVersionsRange(releases, filters.versionFrom, filters.versionTo);
      if (range.length) wantVersions = new Set(range);
    }

    let wantCats = null;
    const selCats = (filters.cfCategories || []).map(Number).filter(n => !isNaN(n));
    if (selCats.length) wantCats = selCats;
    const matchAll = filters.match === 'all';

    const matches = (mod) => {
      if (minDL > 0 && (mod.downloadCount || 0) < minDL) return false;
      const lfi = Array.isArray(mod.latestFilesIndexes) ? mod.latestFilesIndexes : [];
      if (wantLoaders && !lfi.some(f => wantLoaders.has(f.modLoader))) return false;
      if (wantVersions && !lfi.some(f => wantVersions.has(f.gameVersion))) return false;
      if (wantCats) {
        const have = new Set((mod.categories || []).map(c => c.id));
        if (matchAll) { if (!wantCats.every(id => have.has(id))) return false; }
        else if (!wantCats.some(id => have.has(id))) return false;
      }
      return true;
    };

    const first = await cfFetch(base + '&index=0');
    const total = first.pagination ? first.pagination.totalCount
      : (Array.isArray(first.data) ? first.data.length : 0);
    cfLog('total', total);
    if (!total) return { empty: true };

    const capped = Math.min(total, OFFSET_CAP);
    const biased = total > OFFSET_CAP;
    const maxIndex = Math.max(0, capped - CF_PAGE_SIZE);

    for (let i = 0; i < CF_MAX_TRIES; i++) {
      const index = MRMR.utils.randInt(maxIndex + 1);
      const page = (index === 0) ? first : await cfFetch(base + '&index=' + index);
      const hits = Array.isArray(page.data) ? page.data : [];
      const good = hits.filter(matches);
      cfLog('try', i, 'index', index, 'hits', hits.length, 'matches', good.length);
      if (good.length) {
        const pick = good[MRMR.utils.randInt(good.length)];
        return { mod: mapCFMod(pick), biased };
      }
    }
    return { empty: true, reason: 'cf_filter' };
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
    OFFSET_CAP
  };
})();
