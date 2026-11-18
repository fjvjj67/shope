/* Supabase database adapter.
   Gives the app a small Firestore-like API (collection/doc/onSnapshot/set/delete) on top of one
   table `docs(col, id, data)`. Everything stays in sync between devices through:
   1) Supabase Realtime (instant updates while the page is open),
   2) a full refresh when the phone wakes up / the tab becomes visible / the internet comes back,
   3) a light safety refresh every 2 minutes while the page is visible. */
function makeDb(sb) {
  const PAGE = 1000; // Supabase returns at most 1000 rows per request, so we page through bigger collections
  const REFRESH_MS = 120000;
  const gid = () => {
    const a = new Uint8Array(15);
    crypto.getRandomValues(a);
    return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  };
  const stores = {}, // col -> Map(id -> data)
    listeners = {}, // col -> [fn]
    limits = {}, // col -> newest-N limit (e.g. activity log), undefined = everything
    inflight = {}; // col -> running fetch promise (avoid duplicate requests)
  const st = col => stores[col] || (stores[col] = new Map());
  const emit = col => (listeners[col] || []).forEach(f => f());

  /* ---- realtime ---- */
  let chan = null,
    retryTimer = null;
  function ensureChannel() {
    if (chan) return;
    chan = sb
      .channel('docs-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, p => {
        const row = p.new && p.new.col ? p.new : p.old;
        if (!row || !row.col) return;
        const m = st(row.col);
        if (p.eventType === 'DELETE') m.delete(row.id);
        else m.set(row.id, p.new.data);
        emit(row.col);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') refreshAll();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // drop the broken channel and open a fresh one shortly (catch-up refresh happens on SUBSCRIBED)
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            try {
              sb.removeChannel(chan);
            } catch (e) {}
            chan = null;
            ensureChannel();
          }, 3000);
        }
      });
  }

  /* ---- reading ---- */
  async function fetchCol(col, errcb) {
    if (inflight[col]) return inflight[col];
    const run = (async () => {
      const rows = [];
      const lim = limits[col];
      for (let from = 0; ; from += PAGE) {
        let q = sb.from('docs').select('id,data').eq('col', col);
        q = lim ? q.order('created_at', { ascending: false }) : q.order('id');
        const to = lim ? Math.min(from + PAGE, lim) - 1 : from + PAGE - 1;
        const { data, error } = await q.range(from, to);
        if (error) {
          if (errcb) errcb(error);
          return;
        }
        rows.push(...data);
        if (data.length < to - from + 1 || (lim && rows.length >= lim)) break;
      }
      const m = st(col);
      m.clear();
      rows.forEach(r => m.set(r.id, r.data));
      emit(col);
    })();
    inflight[col] = run;
    try {
      await run;
    } finally {
      delete inflight[col];
    }
  }
  let lastRefresh = 0;
  function refreshAll() {
    lastRefresh = Date.now();
    Object.keys(listeners).forEach(c => {
      if (listeners[c].length) fetchCol(c);
    });
  }
  // phone woke up / tab visible again / internet back -> catch up on anything missed
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 5000) refreshAll();
  });
  window.addEventListener('online', () => {
    refreshAll();
    if (typeof toast === 'function') toast('رجع الاتصال بالإنترنت');
  });
  window.addEventListener('offline', () => {
    if (typeof toast === 'function') toast('ماكو إنترنت. التعديلات ما تنحفظ لحد ما يرجع الاتصال', 'bad');
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastRefresh > REFRESH_MS - 1000) refreshAll();
  }, REFRESH_MS);

  /* ---- writing ---- */
  const write = async (col, id, d) => {
    const { error } = await sb
      .from('docs')
      .upsert({ col, id, data: d, updated_at: new Date().toISOString() }, { onConflict: 'col,id' });
    if (error) throw error;
    st(col).set(id, d);
    emit(col);
  };
  const del = async (col, id) => {
    const { error, count } = await sb.from('docs').delete({ count: 'exact' }).eq('col', col).eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error('not_allowed'); // row-level security refused (not admin)
    st(col).delete(id);
    emit(col);
  };

  function listen(col, fire, errcb) {
    (listeners[col] = listeners[col] || []).push(fire);
    ensureChannel();
    if (st(col).size) fire(); // data already cached (another listener on the same collection)
    fetchCol(col, errcb);
    return () => {
      listeners[col] = listeners[col].filter(f => f !== fire);
    };
  }
  function collection(col, opt) {
    opt = opt || {};
    return {
      doc(id) {
        id = id || gid();
        return {
          id,
          set: d => write(col, id, d),
          delete: () => del(col, id),
          get: async () => {
            const { data, error } = await sb.from('docs').select('data').eq('col', col).eq('id', id).maybeSingle();
            if (error) throw error;
            return { exists: !!data, data: () => (data ? data.data : undefined) };
          }
        };
      },
      add: async d => {
        const id = gid();
        await write(col, id, d);
        return { id };
      },
      orderBy(f, dir) {
        return collection(col, Object.assign({}, opt, { ob: f, dir: dir || 'asc' }));
      },
      limit(n) {
        return collection(col, Object.assign({}, opt, { lim: n }));
      },
      onSnapshot(cb, errcb) {
        if (opt.lim) limits[col] = Math.max(limits[col] || 0, opt.lim * 2); // newest rows only (e.g. activity log)
        const fire = () => {
          let rows = [...st(col).entries()].map(([id, data]) => ({ id, data }));
          if (opt.ob) {
            rows.sort((a, b) => {
              const x = a.data[opt.ob],
                y = b.data[opt.ob];
              return (x > y ? 1 : x < y ? -1 : 0) * (opt.dir === 'desc' ? -1 : 1);
            });
          }
          if (opt.lim) rows = rows.slice(0, opt.lim);
          cb({ docs: rows.map(r => ({ id: r.id, data: () => r.data })) });
        };
        return listen(col, fire, errcb);
      }
    };
  }
  return {
    collection: c => collection(c),
    refresh: refreshAll,
    doc(path) {
      const [col, id] = path.split('/');
      return {
        set: d => write(col, id, d),
        onSnapshot(cb, errcb) {
          const fire = () => {
            const d = st(col).get(id);
            cb({ exists: d !== undefined, data: () => d });
          };
          return listen(col, fire, errcb);
        }
      };
    }
  };
}
