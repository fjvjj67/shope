/* Languages.
   The app is written in Arabic. Two things happen on top of that, both live in the page (DOM):

   A) Screen language (staff in China only): every Arabic interface text is swapped to Chinese
      using ZH_DICT / ZH_PATTERNS (js/i18n-zh-dict.js). Layout flips to left-to-right.

   B) Content translation (everyone): text that people TYPE is translated for the reader.
      - Admin (Arabic screen) sees Chinese words written by staff in Arabic.
      - Staff (Chinese screen) sees Arabic words written by the admin in Chinese.
      The original is never changed in the database; only what is shown is translated.
      Translations come from the Supabase function "translate" and are cached
      (on the server for everyone + in this browser), so each sentence is translated once.
      Can be switched off per device from الملفات والنسخ (I18N.setAuto). */
const I18N = (() => {
  const AR_CH = '؀-ۿ';
  const CJK = '㐀-鿿豈-﫿';
  const CJK_PUNCT = '　-〿！-｠';
  const RUN = {
    // a run of Chinese text (may contain digits/Latin/spaces in the middle)
    ar: new RegExp('[' + CJK + '](?:[' + CJK + CJK_PUNCT + '0-9A-Za-z\\s.,\\-·/]*[' + CJK + CJK_PUNCT + '])?', 'g'),
    // a run of Arabic text
    zh: new RegExp('[' + AR_CH + '](?:[' + AR_CH + '\\s0-9.,\\-]*[' + AR_CH + '])?', 'g')
  };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
  const ORIG = new WeakMap(); // text node -> {src: original text, out: what we showed}
  let screen = 'ar'; // interface language
  let auto = true; // content translation on/off for this device
  let started = false;

  /* ---------- A) interface dictionary (Arabic -> Chinese) ---------- */
  const escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let DICT_RX = null,
    DICT = null;
  function buildDict() {
    if (DICT_RX || typeof ZH_DICT === 'undefined') return;
    DICT = {};
    const keys = Object.keys(ZH_DICT)
      .map(k => k.trim())
      .filter(k => k.length > 1 || k === 'و')
      .sort((a, b) => b.length - a.length);
    keys.forEach(k => (DICT[k] = ZH_DICT[k] !== undefined ? ZH_DICT[k] : ZH_DICT[k + ' ']));
    // match whole words only (not inside a longer Arabic word)
    DICT_RX = new RegExp('(^|[^' + AR_CH + '])(' + keys.map(escRx).join('|') + ')(?=$|[^' + AR_CH + '])', 'g');
  }
  function uiZh(s) {
    if (!s || !/[؀-ۿ]/.test(s)) return s;
    buildDict();
    let o = s;
    const t = s.trim();
    for (const [rx, rep] of ZH_PATTERNS) {
      if (!rx.global) {
        if (rx.test(t)) {
          o = t.replace(rx, rep);
          break;
        }
      } else o = o.replace(rx, rep);
    }
    o = o.replace(DICT_RX, (m, pre, w) => pre + (DICT[w] || w));
    return o.replace(/،/g, '，').replace(/؟/g, '？').replace(/«/g, '「').replace(/»/g, '」');
  }

  /* ---------- B) content translation ---------- */
  const CACHE_KEY = () => 'azawi-ct-' + screen;
  let cache = new Map(), // source run -> translation
    outputs = new Set(), // translations we produced (never re-translate them)
    failed = new Map(), // run -> time of failure (retry later)
    queue = new Set(),
    timer = null,
    busy = false;
  function loadCache() {
    cache = new Map();
    try {
      const o = JSON.parse(localStorage.getItem(CACHE_KEY()) || '{}');
      Object.keys(o).forEach(k => {
        cache.set(k, o[k]);
        outputs.add(o[k]);
      });
    } catch (e) {}
  }
  function saveCache() {
    try {
      const entries = [...cache.entries()].slice(-3000); // keep the newest 3000
      localStorage.setItem(CACHE_KEY(), JSON.stringify(Object.fromEntries(entries)));
    } catch (e) {}
  }
  // cached translation of one run of typed text; unknown runs are queued for the server
  function lookup(run) {
    if (cache.has(run)) return cache.get(run);
    if (outputs.has(run)) return run;
    const f = failed.get(run);
    if (!f || Date.now() - f > 300000) queue.add(run);
    return run;
  }
  function contentTr(s) {
    if (!auto || !s) return s;
    if (screen === 'zh') {
      // Arabic runs the interface dictionary cannot fully translate are user text -> translate the whole run
      return s.replace(RUN.zh, r => (/[\u0600-\u06FF]/.test(uiZh(r)) ? lookup(r) : r));
    }
    return s.replace(RUN.ar, lookup);
  }
  function scheduleFlush() {
    if (!queue.size || busy) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 350);
  }
  async function flush() {
    if (busy || !queue.size || typeof SB === 'undefined' || !SB) return;
    busy = true;
    const batch = [...queue].slice(0, 50);
    batch.forEach(r => queue.delete(r));
    try {
      const { data } = await SB.auth.getSession();
      const tok = data && data.session && data.session.access_token;
      const cfg = window.APP_CONFIG;
      const r = await fetch(cfg.url + '/functions/v1/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ to: screen, texts: batch })
      });
      if (!r.ok) throw new Error('http ' + r.status);
      const d = await r.json();
      let got = 0;
      batch.forEach((run, i) => {
        const v = d.out && d.out[i];
        if (v && v !== run) {
          cache.set(run, v);
          outputs.add(v);
          got++;
        } else failed.set(run, Date.now());
      });
      if (got) {
        saveCache();
        walk(document.body);
      }
    } catch (e) {
      batch.forEach(r => failed.set(r, Date.now()));
    } finally {
      busy = false;
      if (queue.size) scheduleFlush();
    }
  }

  /* ---------- apply both to the page ---------- */
  function text(s) {
    if (!s) return s;
    if (screen === 'zh') return uiZh(contentTr(s)); // typed Arabic -> Chinese first, then the interface words
    return contentTr(s);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      const p = root.parentNode;
      if (p && !SKIP.has(p.nodeName)) {
        // re-translate from the original text, not from our own earlier (partial) output
        let src = root.nodeValue;
        const rec = ORIG.get(root);
        if (rec && rec.out === src) src = rec.src;
        const v = text(src);
        if (v !== root.nodeValue) root.nodeValue = v;
        ORIG.set(root, { src, out: v });
      }
    } else if (root.nodeType === 1 && root.nodeName !== 'SCRIPT' && root.nodeName !== 'STYLE') {
      if (screen === 'zh')
        for (const a of ['placeholder', 'aria-label', 'title']) {
          const v = root.getAttribute(a);
          if (v) {
            const t = uiZh(v);
            if (t !== v) root.setAttribute(a, t);
          }
        }
      if (!SKIP.has(root.nodeName)) for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
    }
    scheduleFlush();
  }
  function start(lang) {
    screen = lang === 'zh' ? 'zh' : 'ar';
    try {
      auto = localStorage.getItem('ts_ct') !== '0';
    } catch (e) {}
    loadCache();
    if (screen === 'zh') {
      const h = document.documentElement;
      h.lang = 'zh-CN';
      h.dir = 'ltr';
      h.classList.add('zh');
      document.querySelectorAll('[dir="rtl"]').forEach(e => {
        e.dir = 'ltr';
        e.lang = 'zh-CN';
      });
      document.title = uiZh(document.title);
    }
    walk(document.body);
    if (started) return;
    started = true;
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else walk(m.target);
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'title']
    });
  }
  function setAuto(on) {
    auto = !!on;
    try {
      localStorage.setItem('ts_ct', on ? '1' : '0');
    } catch (e) {}
    if (typeof render === 'function') render(); // re-draw with or without translations
  }
  return {
    start,
    setAuto,
    isAuto: () => auto,
    screen: () => screen,
    ui: uiZh, // translate one interface string (used by tests)
    content: s => contentTr(s) // cached translation of typed text (used by Excel export)
  };
})();
