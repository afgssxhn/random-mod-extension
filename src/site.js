window.MRMR = window.MRMR || {};
MRMR.site = (() => {
  // Map a hostname to a supported site id, or null when neither matches.
  function fromHostname(host) {
    host = String(host || '').toLowerCase();
    if (host.includes('curseforge.com')) return 'curseforge';
    if (host.includes('modrinth.com')) return 'modrinth';
    return null;
  }

  // Content-script / on-page detection.
  function detect() {
    return fromHostname(typeof location !== 'undefined' ? location.hostname : '');
  }

  // Popup detection: read the active tab's host. host_permissions for both
  // sites make `tab.url` readable without the extra "tabs" permission; any
  // other (or unreadable) tab falls through to null → Modrinth default.
  async function detectActiveTab() {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return null;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tabs && tabs[0] && tabs[0].url;
      if (!url) return null;
      return fromHostname(new URL(url).hostname);
    } catch { return null; }
  }

  const META = {
    modrinth:   { name: 'Modrinth',   modPath: 'https://modrinth.com/mod/' },
    curseforge: { name: 'CurseForge', modPath: 'https://www.curseforge.com/minecraft/mc-mods/' }
  };

  function meta(site) { return META[site] || META.modrinth; }
  function label(site) { return meta(site).name; }

  return { fromHostname, detect, detectActiveTab, meta, label };
})();
