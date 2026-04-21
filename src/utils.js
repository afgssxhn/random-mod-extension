window.MRMR = window.MRMR || {};
MRMR.utils = (() => {
  const LOADER_SLUG = {
    'Fabric': 'fabric',
    'Forge': 'forge',
    'NeoForge': 'neoforge',
    'Quilt': 'quilt',
    'LiteLoader': 'liteloader',
    'Rift': 'rift',
    'Legacy Fabric': 'legacy-fabric',
    'Babric': 'babric',
    'Modloader': 'modloader'
  };

  const LOADERS = Object.keys(LOADER_SLUG);

  function loaderSlug(name) {
    return LOADER_SLUG[name] || String(name).toLowerCase().replace(/\s+/g, '-');
  }

  function formatCount(n) {
    const x = Number(n) || 0;
    if (x >= 1_000_000) {
      const v = x / 1_000_000;
      return (x >= 10_000_000 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'M';
    }
    if (x >= 1_000) {
      const v = x / 1_000;
      return (x >= 10_000 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'K';
    }
    return String(x);
  }

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'string') el.style.cssText = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  return { LOADER_SLUG, LOADERS, loaderSlug, formatCount, randInt, h };
})();
