window.MRMR = window.MRMR || {};
MRMR.storage = (() => {
  const TAG_TTL_MS = 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = 'cache:';
  const FILTERS_KEY = 'filters';

  // Filters are kept independently per site (loaders/version/categories/min all
  // differ between Modrinth and CurseForge), so nothing one site sets can bleed
  // into the other.
  const DEFAULT_FILTERS = Object.freeze({
    loaders: ['Fabric', 'Forge', 'NeoForge', 'Quilt'],
    versionFrom: '',
    versionTo: '',
    categories: [],     // per-site category values (Modrinth slugs / CF slugs)
    match: 'any',
    side: 'Any',        // Modrinth only — Side is hidden on CurseForge
    minDownloads: ''
  });

  function normSite(site) { return site === 'curseforge' ? 'curseforge' : 'modrinth'; }

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage;
  }

  async function getCached(key) {
    if (!hasChromeStorage()) return null;
    const fullKey = CACHE_PREFIX + key;
    const obj = await chrome.storage.local.get(fullKey);
    const e = obj[fullKey];
    if (!e || typeof e !== 'object') return null;
    if (Date.now() - e.ts > TAG_TTL_MS) return null;
    return e.v;
  }

  async function setCached(key, v) {
    if (!hasChromeStorage()) return;
    const fullKey = CACHE_PREFIX + key;
    await chrome.storage.local.set({ [fullKey]: { ts: Date.now(), v } });
  }

  // Stored shape: { modrinth: {...}, curseforge: {...} }. One-time migration from
  // the old flat (shared) shape seeds both sites — Modrinth keeps `categories`,
  // CurseForge takes the old `cfCategories`; everything else is copied as the
  // starting point for each site.
  function asPerSite(saved) {
    if (!saved || typeof saved !== 'object') return {};
    if (saved.modrinth || saved.curseforge) return saved;     // already per-site
    if (!('loaders' in saved)) return {};                     // unknown → defaults
    const { cfCategories, categories, ...shared } = saved;
    return {
      modrinth: { ...shared, categories: categories || [] },
      curseforge: { ...shared, categories: cfCategories || [] }
    };
  }

  async function getFilters(site) {
    site = normSite(site);
    if (!hasChromeStorage()) return { ...DEFAULT_FILTERS };
    const obj = await chrome.storage.sync.get(FILTERS_KEY);
    const map = asPerSite(obj[FILTERS_KEY]);
    return { ...DEFAULT_FILTERS, ...(map[site] || {}) };
  }

  async function setFilters(site, f) {
    site = normSite(site);
    if (!hasChromeStorage()) return;
    const obj = await chrome.storage.sync.get(FILTERS_KEY);
    const map = asPerSite(obj[FILTERS_KEY]);
    map[site] = f;
    await chrome.storage.sync.set({ [FILTERS_KEY]: map });
  }

  return { getCached, setCached, getFilters, setFilters, DEFAULT_FILTERS };
})();
