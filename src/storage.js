window.MRMR = window.MRMR || {};
MRMR.storage = (() => {
  const TAG_TTL_MS = 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = 'cache:';
  const FILTERS_KEY = 'filters';

  const DEFAULT_FILTERS = Object.freeze({
    loaders: ['Fabric', 'Forge', 'NeoForge', 'Quilt'],
    versionFrom: '',
    versionTo: '',
    categories: [],
    match: 'any',
    side: 'Any',
    minDownloads: ''
  });

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

  async function getFilters() {
    if (!hasChromeStorage()) return { ...DEFAULT_FILTERS };
    const obj = await chrome.storage.sync.get(FILTERS_KEY);
    const saved = obj[FILTERS_KEY];
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_FILTERS };
    return { ...DEFAULT_FILTERS, ...saved };
  }

  async function setFilters(f) {
    if (!hasChromeStorage()) return;
    await chrome.storage.sync.set({ [FILTERS_KEY]: f });
  }

  return { getCached, setCached, getFilters, setFilters, DEFAULT_FILTERS };
})();
