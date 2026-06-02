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

  async function searchRandomMod(filters) {
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

  return {
    getGameVersions,
    getCategories,
    searchRandomMod,
    buildFacets,
    computeVersionsRange,
    OFFSET_CAP
  };
})();
