window.MRMR = window.MRMR || {};
MRMR.api = (() => {
  const BASE = 'https://api.modrinth.com/v2';
  const OFFSET_CAP = 10000;
  const MIN_DL_MAX_TRIES = 5;

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

  async function getCategories() {
    const cached = await MRMR.storage.getCached('categories');
    if (cached) return cached;
    const data = await fetchJSON(BASE + '/tag/category');
    const mods = data.filter(c => c.project_type === 'mod').map(c => c.name);
    await MRMR.storage.setCached('categories', mods);
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

  function buildFacets(filters, versionsRange) {
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

    return JSON.stringify(groups);
  }

  async function searchRandomMod(filters) {
    let versionsRange = [];
    if (filters.versionFrom || filters.versionTo) {
      const gv = await getGameVersions();
      const releases = gv.filter(v => v.version_type === 'release');
      versionsRange = computeVersionsRange(releases, filters.versionFrom, filters.versionTo);
    }

    const facets = buildFacets(filters, versionsRange);
    const qs = 'facets=' + encodeURIComponent(facets) + '&limit=1';

    const first = await fetchJSON(BASE + '/search?' + qs + '&offset=0');
    if (first.total_hits === 0) return { empty: true };

    const capped = Math.min(first.total_hits, OFFSET_CAP);
    const minDL = Number(filters.minDownloads) || 0;
    const maxTries = minDL > 0 ? MIN_DL_MAX_TRIES : 1;

    for (let i = 0; i < maxTries; i++) {
      const offset = MRMR.utils.randInt(capped);
      const res = await fetchJSON(BASE + '/search?' + qs + '&offset=' + offset);
      const hit = res.hits && res.hits[0];
      if (!hit) continue;
      if (hit.downloads >= minDL) {
        return { mod: hit, biased: first.total_hits > OFFSET_CAP };
      }
    }
    return { empty: true, reason: 'min_downloads' };
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
