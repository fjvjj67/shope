/* Nicer form controls, applied to every form after it opens (openModal → enhanceForm):
   - Factory picker: a bottom sheet with search, recent factories on top, letter badge + order count.
     The real <select name="factoryId"> stays in the form (visually hidden), so saving code is unchanged.
   - Dates: shown as 18/11/2026 like the rest of the app (the phone's own picker still opens on tap);
     "تاريخ الطلب" also gets quick chips: اليوم / أمس.
   - Money: the currency sign sits inside the "إجمالي الطلب" field. */
const AV_COLORS = ['#ff8a3d', '#5aa9e6', '#7ad3a0', '#f2c060', '#c792ea', '#ff7d8b', '#4fd1c5', '#e8a87c'];
const avColor = s => {
  let h = 0;
  for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
};
const avLetter = s => (String(s || '').trim()[0] || '?').toUpperCase();
const normQ = s =>
  String(s || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();

function enhanceForm(f) {
  if (!f) return;
  f.querySelectorAll('select[name="factoryId"]').forEach(factoryPicker);
  f.querySelectorAll('input[type="date"]').forEach(dateShow);
  if (f.elements.orderDate && f.elements.orderDate.type === 'date') dateChips(f.elements.orderDate);
  if (f.elements.total && f.elements.total.hasAttribute('data-num')) curPrefix(f.elements.total, f);
}

/* ---------- factory picker ---------- */
function factoryInfo() {
  const info = {};
  S.orders.forEach(o => {
    const x = info[o.factoryId] || (info[o.factoryId] = { n: 0, last: 0, lastDate: '' });
    x.n++;
    const t = +o.createdAt || Date.parse(o.orderDate || '') || 1;
    if (t >= x.last) {
      x.last = t;
      x.lastDate = o.orderDate || '';
    }
  });
  return info;
}
function factoryPicker(sel) {
  if (sel.dataset.picker) return;
  sel.dataset.picker = '1';
  sel.classList.add('sel-hidden');
  sel.tabIndex = -1;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fpick';
  const paint = () => {
    const fct = byId('factories', sel.value);
    b.innerHTML = fct
      ? `<i class="av" style="--av:${avColor(fct.name)}">${esc(avLetter(fct.name))}</i><span class="nm">${esc(fct.name)}</span><span class="cv">⌄</span>`
      : `<span class="nm ph">اختر المصنع</span><span class="cv">⌄</span>`;
    b.disabled = sel.disabled;
  };
  sel.addEventListener('change', paint);
  // nf-toggle disables the select while a new factory is being typed
  new MutationObserver(paint).observe(sel, { attributes: true, attributeFilter: ['disabled'] });
  b.addEventListener('click', () => {
    if (!sel.disabled) openFactorySheet(sel);
  });
  sel.after(b);
  paint();
  // "+ مصنع جديد" lives inside the sheet now → the side button only shows while typing a new name (as "من القائمة"),
  // so the picker gets the full width on small phones
  const nb = sel.parentElement && sel.parentElement.querySelector('[data-act="nf-toggle"]'),
    box = document.getElementById('nfBox');
  if (nb && box) {
    const sync = () => {
      nb.hidden = box.hidden;
      b.hidden = !box.hidden;
    };
    new MutationObserver(sync).observe(box, { attributes: true, attributeFilter: ['hidden'] });
    sync();
  }
}
function openFactorySheet(sel) {
  closeFactorySheet();
  const info = factoryInfo();
  const all = S.factories.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const recent = all
    .filter(fc => info[fc.id] && info[fc.id].last)
    .sort((a, b) => info[b.id].last - info[a.id].last)
    .slice(0, 4);
  const row = fc => {
    const x = info[fc.id];
    const sub = x ? (x.n === 1 ? 'طلب واحد' : x.n === 2 ? 'طلبين' : x.n + (x.n <= 10 ? ' طلبات' : ' طلب')) + (x.lastDate ? ' · آخر طلب ' + fmtD(x.lastDate) : '') : 'بدون طلبات';
    return `<button type="button" class="fs-row${fc.id === sel.value ? ' on' : ''}" data-fid="${fc.id}"><i class="av" style="--av:${avColor(fc.name)}">${esc(avLetter(fc.name))}</i><span class="t"><b>${esc(fc.name)}</b><small>${sub}</small></span>${fc.id === sel.value ? '<span class="ck">✓</span>' : ''}</button>`;
  };
  const ov = document.createElement('div');
  ov.className = 'fs-ovl';
  ov.id = 'fsheet';
  const canNew = !!document.querySelector('#mform [data-act="nf-toggle"]');
  ov.innerHTML = `<div class="fs" role="dialog" aria-modal="true" aria-label="اختر المصنع">
    <div class="fs-h"><b>اختر المصنع</b><button type="button" class="icon" data-fs="close" aria-label="إغلاق">${ico('x')}</button></div>
    <input type="search" class="fs-q" placeholder="ابحث باسم المصنع…" autocomplete="off" aria-label="بحث">
    <div class="fs-list">
      ${canNew ? `<button type="button" class="fs-row fs-new" data-fs="new"><i class="av">+</i><span class="t"><b>مصنع جديد</b><small>اكتب اسمه وينضاف ويه الطلب</small></span></button>` : ''}
      ${recent.length ? `<div class="fs-sec">آخر المصانع</div>${recent.map(row).join('')}` : ''}
      <div class="fs-sec">كل المصانع (${all.length})</div><div class="fs-all">${all.map(row).join('')}</div>
      <div class="fs-none" hidden>ما لكيت مصنع بهذا الاسم</div>
    </div></div>`;
  document.body.appendChild(ov);
  const q = ov.querySelector('.fs-q');
  q.addEventListener('input', () => {
    const v = normQ(q.value);
    const secs = ov.querySelectorAll('.fs-sec');
    const recentRows = [...ov.querySelectorAll('.fs-list > .fs-row[data-fid]')];
    // while searching, show one filtered list
    secs.forEach(s => (s.hidden = !!v));
    recentRows.forEach(r => (r.hidden = !!v));
    let shown = 0;
    ov.querySelectorAll('.fs-all .fs-row').forEach(r => {
      const hit = !v || normQ(r.querySelector('b').textContent).includes(v);
      r.hidden = !hit;
      if (hit) shown++;
    });
    ov.querySelector('.fs-none').hidden = shown > 0;
  });
  ov.addEventListener('click', e => {
    if (e.target === ov) return closeFactorySheet();
    const t = e.target.closest('[data-fid],[data-fs]');
    if (!t) return;
    if (t.dataset.fs === 'close') return closeFactorySheet();
    if (t.dataset.fs === 'new') {
      closeFactorySheet();
      const nb = document.querySelector('#mform [data-act="nf-toggle"]');
      if (nb) nb.click();
      return;
    }
    sel.value = t.dataset.fid;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    closeFactorySheet();
  });
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeFactorySheet();
    }
  });
  if (!('ontouchstart' in window)) setTimeout(() => q.focus(), 30);
}
function closeFactorySheet() {
  const o = document.getElementById('fsheet');
  if (o) o.remove();
}

/* ---------- dates: show 18/11/2026, keep the phone's own picker ---------- */
const VAL = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
function dateShow(inp) {
  if (inp.dataset.dshow) return;
  inp.dataset.dshow = '1';
  const w = document.createElement('div');
  w.className = 'dwrap';
  const s = document.createElement('span');
  s.className = 'dshow';
  inp.before(w);
  w.append(s, inp);
  const upd = () => {
    const v = VAL.get.call(inp);
    s.innerHTML = v
      ? `<span>${fmtD(v)}</span><small>${dayName(v)}</small>`
      : `<span class="ph">${esc(inp.getAttribute('placeholder') || 'اختر التاريخ')}</span>`;
  };
  // code sets .value directly in places (e.g. "تم التسديد" fills today) → keep the display in step
  Object.defineProperty(inp, 'value', {
    configurable: true,
    get() {
      return VAL.get.call(this);
    },
    set(v) {
      VAL.set.call(this, v);
      upd();
    }
  });
  inp.addEventListener('input', upd);
  inp.addEventListener('change', upd);
  inp.addEventListener('click', () => {
    try {
      inp.showPicker();
    } catch (e) {}
  });
  upd();
}
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const dayName = iso => {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '' : DAYS_AR[d.getDay()];
};
function dateChips(inp) {
  const box = inp.closest('.fld');
  if (!box || box.querySelector('.dq')) return;
  const c = document.createElement('div');
  c.className = 'chips dq';
  const mk = (label, iso) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.addEventListener('click', () => {
      inp.value = iso;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      mark();
    });
    b.dataset.iso = iso;
    return b;
  };
  const mark = () => c.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.iso === VAL.get.call(inp)));
  c.append(mk('اليوم', todayISO()), mk('أمس', addDays(todayISO(), -1)));
  box.appendChild(c);
  inp.addEventListener('change', mark);
  mark();
}

/* ---------- money: currency sign inside the field ---------- */
function curPrefix(inp, f) {
  if (inp.dataset.cur) return;
  inp.dataset.cur = '1';
  const w = document.createElement('div');
  w.className = 'cin';
  const p = document.createElement('span');
  p.className = 'cs';
  const cur = () => (f.elements.currency && f.elements.currency.value) || 'CNY';
  const paint = () => (p.textContent = CUR[cur()] || '¥');
  inp.before(w);
  w.append(p, inp);
  if (f.elements.currency && f.elements.currency.tagName === 'SELECT') f.elements.currency.addEventListener('change', paint);
  paint();
}
