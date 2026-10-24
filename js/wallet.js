/* Shipping-company accounts: money held in China, statement, pending transfers */
let WCAR = null,
  WS = {},
  CARSEL = '';
try {
  CARSEL = localStorage.getItem('ts_car') || '';
} catch (e) {}
function setCar(id) {
  CARSEL = id || '';
  if (id) WCAR = id;
  try {
    localStorage.setItem('ts_car', CARSEL);
  } catch (e) {}
}
const ordRem = o =>
  r2(
    Math.max(
      itemsTotal(o) - S.payments.filter(p => p.orderId === o.id && p.paid).reduce((a, p) => a + (+p.amount || 0), 0),
      0
    )
  );
function walletRows(cid) {
  const c = byId('carriers', cid);
  if (!c) return [];
  const rows = [];
  if (+c.openBal)
    rows.push({
      k: 'open',
      d: '',
      amt: -+c.openBal,
      cur: c.openCur || 'USD',
      t: 'رصيد سابق',
      sub: +c.openBal > 0 ? 'كان عليك لهم' : 'كان لك عندهم'
    });
  S.ctx
    .filter(x => x.carrierId === cid)
    .forEach(x => {
      if (x.type === 'in') {
        if (x.status === 'wait') return;
        rows.push({
          k: 'in',
          id: x.id,
          d: x.date || '',
          amt: +x.amt || 0,
          cur: x.cur || 'CNY',
          t: 'أرسلت فلوس',
          sub: x.paid
            ? 'دفعت ' + num(x.paid) + ' ' + (x.payCur === 'IQD' ? 'د.ع' : '$') + (rateTxt(x) ? ' · ' + rateTxt(x) : '')
            : '',
          rc: (x.files || [])[0] || null
        });
      } else
        rows.push({
          k: 'fee',
          id: x.id,
          d: x.date || '',
          amt: -(+x.amt || 0),
          cur: x.cur || 'CNY',
          t: x.ft === 'نقل' ? 'نقل من المصنع' : x.ft === 'أخرى' ? 'مصاريف أخرى' : 'أجور شحن',
          sub: [x.orderId ? orderLabel(byId('orders', x.orderId)) : '', x.note || ''].filter(Boolean).join(' · ')
        });
    });
  S.payments
    .filter(p => p.paid && p.via === cid)
    .forEach(p => {
      const o = byId('orders', p.orderId);
      rows.push({
        k: 'out',
        pid: p.id,
        d: p.paidDate || p.dueDate || '',
        amt: -(+p.amount || 0),
        cur: o ? o.currency : 'CNY',
        t: 'دفعوا لـ ' + (o ? factoryName(o.factoryId) : 'مصنع'),
        sub: (o ? o.ref : '') + (p.label ? ' · ' + p.label : '')
      });
    });
  S.shipments
    .filter(x => x.carrierId === cid && shipRemaining(x) > 0.001)
    .forEach(x =>
      rows.push({
        k: 'fee',
        sid: x.id,
        d: x.departDate || x.eta || '',
        amt: -shipRemaining(x),
        cur: x.currency || 'USD',
        t: 'أجور شحنة ' + (x.ref || ''),
        sub: shipName(x.status)
      })
    );
  rows.sort((a, b) => (a.d || '').localeCompare(b.d || ''));
  const run = {};
  rows.forEach(r => {
    run[r.cur] = r2((run[r.cur] || 0) + r.amt);
    r.bal = run[r.cur];
  });
  return rows;
}
function rateTxt(x) {
  if (!x.paid || !x.amt) return '';
  if (x.payCur === 'IQD') {
    const r = x.paid / x.amt;
    return 'اليوان كلّفك ' + num(r2(r)) + ' د.ع';
  }
  if (x.cur === 'USD' || x.payCur === x.cur) return '';
  return 'كل دولار = ' + Math.round((x.amt / x.paid) * 100) / 100 + ' يوان';
}
function walletBal(cid) {
  const b = {};
  walletRows(cid).forEach(r => {
    b[r.cur] = r2((b[r.cur] || 0) + r.amt);
  });
  return b;
}
function balLine(b) {
  const k = Object.keys(b).filter(c => Math.abs(b[c]) > 0.001);
  if (!k.length) return money(0, 'CNY');
  return k.map(c => (b[c] < 0 ? 'عليك ' + money(-b[c], c) : money(b[c], c))).join(' · ');
}
const WIC = {
  in: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  out: '<path d="M3 21V10l6 4v-4l6 4V6h6v15z"/>',
  fee: '<path d="M3 17l2 3h14l2-3-9-3z"/><path d="M12 14V4l5 4"/>',
  open: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const wico = k =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WIC[k]}</svg>`;
function pendList(cid) {
  return S.ctx
    .filter(x => x.type === 'in' && x.status === 'wait' && (!cid || x.carrierId === cid))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
function pendCard(c) {
  const L = pendList(c.id);
  if (!L.length) return '';
  return `<div class="card pend"><h3>حوالات بالانتظار ${pill('warn', L.length)}</h3>${L.map(x => {
    const d = diffDays(x.date || todayISO());
    const rc = (x.files || [])[0];
    return `<div class="wtx wait"><span class="ic">⏳</span><div class="t"><b>دفعت ${num(x.paid)} ${x.payCur === 'IQD' ? 'د.ع' : '$'}${rc ? ` <button type="button" class="rcbtn" data-act="view-rc" data-id="${rc.id}" aria-label="صورة الوصل">🧾</button>` : ''}</b><small>${fmtD(x.date)} · ${d < 0 ? 'صارلها ' + plural(-d) : 'اليوم'}${x.amt ? ' · متوقع ' + money(x.amt, x.cur) : ''}${x.note ? ' · ' + esc(x.note) : ''}</small></div><div class="r"><button type="button" class="btn sm" data-act="w-confirm" data-id="${x.id}">وصلت ✓</button>${ADMIN ? `<button class="icon" style="width:30px;height:30px" data-act="del-ask" data-col="ctx" data-id="${x.id}" aria-label="حذف">${ico('trash', 14)}</button>` : ''}</div></div>`;
  }).join('')}</div>`;
}
function confirmForm(id) {
  const x = byId('ctx', id);
  if (!x) return;
  openModal(
    'تأكيد وصول الحوالة',
    `<div class="hint">دفعت ${num(x.paid)} ${x.payCur === 'IQD' ? 'د.ع' : '$'} بتاريخ ${fmtD(x.date)}</div>${fld('كم سجلوا لك؟', inp('wAmt', x.amt || '', 'number', 'required'))}<div class="chips" role="group">${[
      ['CNY', 'يوان ¥'],
      ['USD', 'دولار $']
    ]
      .map(
        o =>
          `<button type="button" class="chip" data-act="w-seg" data-k="cur" data-v="${o[0]}" aria-pressed="${o[0] === (x.cur || 'CNY')}">${o[1]}</button>`
      )
      .join('')}</div>${fld('تاريخ الوصول', inp('wDate', todayISO(), 'date'))}<p class="hint" id="cHint"></p>`,
    {
      onOpen: f => {
        WS = { kind: 'confirm', ist: 'ok', pc: x.payCur, cur: x.cur || 'CNY', car: x.carrierId };
        const h = () => {
          const a = num2(f.elements.wAmt.value);
          $('#cHint').textContent = a ? rateTxt({ paid: x.paid, amt: a, payCur: x.payCur, cur: WS.cur }) || '' : '';
        };
        f.addEventListener('input', h);
        h();
      },
      onSubmit: async f => {
        const amt = r2(num2(f.elements.wAmt.value));
        if (!(amt > 0)) {
          ferr('اكتب كم سجلوا لك', 'wAmt');
          return;
        }
        await put(
          'ctx',
          Object.assign({}, x, {
            status: 'ok',
            amt,
            cur: WS.cur,
            date: val(f, 'wDate') || todayISO(),
            sentDate: x.sentDate || x.date
          })
        );
        closeModal();
        toast('تم: الحوالة وصلت');
      }
    }
  );
}
async function viewRc(fid) {
  const x = S.ctx.find(c => (c.files || []).some(f => f.id === fid)),
    meta = x && x.files.find(f => f.id === fid);
  openLb(
    meta ? 'وصل · ' + meta.name : 'وصل',
    meta && meta.thumb ? `<img class="lbimg blur" src="${meta.thumb}" alt="">` : '<div class="skel"></div>',
    fid,
    ''
  );
  const d = await loadFile(fid).catch(() => null);
  if (LB.fid !== fid) return;
  if (!d) {
    $('#lbBody').innerHTML = '<p>تعذر فتح الوصل.</p>';
    return;
  }
  $('#lbBody').innerHTML = isImg(d.type)
    ? `<img class="lbimg" src="${d.data}" alt="">`
    : `<p>${esc(d.name)}</p><button class="btn" data-act="lb-dl">تنزيل</button>`;
}
const WACTS = () =>
  `<div class="wacts"><button class="wact in" type="button" data-act="w-in"><span>${wico('in')}</span>أرسلت فلوس</button><button class="wact out" type="button" data-act="w-pay"><span>${wico('out')}</span>دفعوا لمصنع</button><button class="wact fee" type="button" data-act="w-fee"><span>${wico('fee')}</span>شحن ونقل</button></div>`;
async function ensureCarrier() {
  if (S.carriers.length) return true;
  if (!CANEDIT) {
    toast('للمدير فقط', 'bad');
    return false;
  }
  const nm = coName(ACTIVE);
  const name = /كوان|قوان/.test(nm) ? 'Guangzhou' : /ا[يى]و/.test(nm) ? 'Yiwu' : 'شحن ' + nm;
  try {
    await put(
      'carriers',
      { id: newId('carriers'), createdAt: Date.now(), name, contact: '', phone: '', mode: 'sea', note: '' },
      { quiet: true }
    );
    for (let i = 0; i < 40 && !S.carriers.length; i++) await new Promise(r => setTimeout(r, 50));
    return S.carriers.length > 0;
  } catch (e) {
    return false;
  }
}
function stmtModal() {
  const c = WCAR && byId('carriers', WCAR);
  if (!c) return;
  const all = walletRows(c.id).slice().reverse();
  openModal(
    'كشف حساب ' + c.name,
    `<div>${all.map(r => `<div class="wtx ${r.k}"><span class="ic">${wico(r.k)}</span><div class="t"><b>${esc(r.t)}${r.rc ? ` <button type="button" class="rcbtn" data-act="view-rc" data-id="${r.rc.id}" aria-label="صورة الوصل">🧾</button>` : ''}</b><small>${r.d ? fmtD(r.d) : '—'}${r.sub ? ' · ' + esc(r.sub) : ''}</small></div><div class="r"><b>${r.amt >= 0 ? '+' : '−'}${money(Math.abs(r.amt), r.cur)}</b><small>الرصيد ${r.bal < 0 ? '−' : ''}${num(Math.abs(r.bal))}</small>${ADMIN && r.id ? `<button class="icon" style="width:30px;height:30px" data-act="del-ask" data-col="ctx" data-id="${r.id}" aria-label="حذف">${ico('trash', 14)}</button>` : ''}</div></div>`).join('') || '<p style="color:var(--mute)">لا توجد حركات</p>'}</div>`,
    { wide: true }
  );
}
function carrierCard() {
  if (!S.carriers.length) return '';
  const list = S.carriers.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const one = list.length === 1;
  const rows = list
    .map(c => {
      const b = walletBal(c.id),
        neg = Object.values(b).some(v => v < -0.001);
      return `<button type="button" class="wrow" data-act="car-go" data-id="${c.id}"><span class="ic">${ico('truck', 18)}</span><span class="t"><b>${esc(c.name)}</b><small>رصيدك عندهم</small></span><b class="${neg ? 'neg' : ''}">${balLine(b)}</b></button>`;
    })
    .join('');
  return `<div class="card"><h3>${one ? 'رصيدك عند ' + esc(list[0].name) : 'رصيدك عند شركات الشحن'}</h3>${rows}${one ? `<div class="wacts" style="margin-top:12px"><button class="wact in" type="button" data-act="w-in"><span>${wico('in')}</span>أرسلت فلوس</button><button class="wact out" type="button" data-act="w-pay"><span>${wico('out')}</span>دفعوا لمصنع</button><button class="wact fee" type="button" data-act="w-fee"><span>${wico('fee')}</span>شحن ونقل</button></div>` : ''}</div>`;
}
function carriersView(home) {
  if (!S.carriers.length && home)
    return `<div class="d-wal"><section class="zhero"><span class="zl">رصيدك عند شركة الشحن</span><div class="zbig">0<small>¥</small></div><span style="color:var(--mute);font-size:14px">ابدأ بـ "أرسلت فلوس"، والنظام يفتح حساب شركة الشحن مال ${esc(coName(ACTIVE))} تلقائياً.</span></section>${WACTS()}</div><div class="d-stmt"><div class="card"><h3>كشف الحساب</h3><p style="color:var(--mute);margin:0">لا توجد حركات بعد.</p></div></div>`;
  if (!S.carriers.length)
    return empty(
      'لا توجد شركات شحن',
      'أضف شركة الشحن اللي تتعامل وياها (مثلاً مكتب كوانزو ومكتب ايوو). فلوسك تتجمع عندها وهي تدفع للمصانع.',
      `<button class="btn" data-act="new-carrier">${ico('plus')} شركة شحن جديدة</button>`
    );
  if (!WCAR || !byId('carriers', WCAR))
    WCAR = S.carriers.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'))[0].id;
  const c = byId('carriers', WCAR),
    rows = walletRows(WCAR),
    b = {};
  rows.forEach(r => {
    b[r.cur] = r2((b[r.cur] || 0) + r.amt);
  });
  const main = Math.abs(b.CNY || 0) > 0.001 || !Object.keys(b).length ? 'CNY' : Object.keys(b)[0],
    mv = b[main] || 0;
  const sumK = k => {
    const o = {};
    rows.filter(r => r.k === k).forEach(r => addTo(o, r.cur, Math.abs(r.amt)));
    return multi(o);
  };
  const others = Object.keys(b).filter(k => k !== main && Math.abs(b[k]) > 0.001);
  const all = rows.slice().reverse(),
    shown = home ? all.slice(0, 6) : all;
  return `${S.carriers.length > 1 || !home ? `<div class="wcar" role="group" aria-label="شركة الشحن">` : '<div hidden>'}${S.carriers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    .map(
      x =>
        `<button type="button" data-act="w-car" data-id="${x.id}" aria-pressed="${x.id === WCAR}">${esc(x.name)}</button>`
    )
    .join('')}</div>
  <div class="${home ? 'd-wal-wrap' : 'panels'}">
   <div class="${home ? 'd-wal' : ''}" style="display:flex;flex-direction:column;gap:14px;min-width:0">
    <section class="zhero"><span class="zl" style="display:flex;align-items:center;justify-content:space-between;gap:8px">رصيدك عند ${esc(c.name)}<button type="button" class="zedit" data-act="edit-carrier" data-id="${c.id}" aria-label="تعديل بيانات شركة الشحن" title="تعديل الاسم أو الهاتف أو الرصيد السابق">${ico('edit', 15)}</button></span><div class="zbig">${mv < 0 ? '−' : ''}${num(Math.abs(mv))}<small>${CUR[main] || main}</small></div>
     <span style="color:var(--mute);font-size:14px">${mv >= 0 ? 'هذا المبلغ موجود عندهم لك، ويدفعون منه للمصانع.' : 'انت مطلوب لهم بهذا المبلغ.'}${others.length ? ' · وبالعملة الثانية: ' + balLine(Object.fromEntries(others.map(k => [k, b[k]]))) : ''}</span>
     <div class="zrow"><div><small>أرسلت</small><b style="color:var(--z-g,#86d49f)">${sumK('in')}</b></div><div><small>دفعوا للمصانع</small><b style="color:var(--z-r,#ff8f7d)">${sumK('out')}</b></div><div><small>شحن ونقل</small><b style="color:var(--z-y,#f2c060)">${sumK('fee')}</b></div></div></section>
    ${WACTS()}
   </div>
   <div class="${home ? 'd-stmt' : ''}" style="display:flex;flex-direction:column;gap:14px;min-width:0">${pendCard(c)}<div class="card"><h3>كشف الحساب${home && all.length > shown.length ? ` <button class="btn ghost sm" data-act="w-stmt">الكل (${all.length})</button>` : ''}</h3>${shown.length ? shown.map(r => `<div class="wtx ${r.k}"><span class="ic">${wico(r.k)}</span><div class="t"><b>${esc(r.t)}${r.rc ? ` <button type="button" class="rcbtn" data-act="view-rc" data-id="${r.rc.id}" aria-label="صورة الوصل">🧾</button>` : ''}</b><small>${r.d ? fmtD(r.d) : '—'}${r.sub ? ' · ' + esc(r.sub) : ''}</small></div><div class="r"><b>${r.amt >= 0 ? '+' : '−'}${money(Math.abs(r.amt), r.cur)}</b><small>الرصيد ${r.bal < 0 ? '−' : ''}${num(Math.abs(r.bal))}</small>${ADMIN && r.id ? `<button class="icon" style="width:30px;height:30px" data-act="del-ask" data-col="ctx" data-id="${r.id}" aria-label="حذف">${ico('trash', 14)}</button>` : ''}</div></div>`).join('') : '<p style="color:var(--mute);margin:0">لا توجد حركات بعد. ابدأ بـ "أرسلت فلوس".</p>'}</div></div>
  </div>`;
}
function wCarPick(direct) {
  return `<div class="fld"><span>${direct ? 'منو دفع؟' : 'شركة الشحن'}</span><div class="zpick" role="group">${S.carriers.map(x => `<button type="button" data-act="w-pick" data-id="${x.id}" aria-pressed="${x.id === WS.car}">${esc(x.name)}</button>`).join('')}${direct ? `<button type="button" data-act="w-pick" data-id="" aria-pressed="${!WS.car}">دفعت مباشرة</button>` : ''}</div></div>`;
}
function comboHTML(id, opt) {
  return `<div class="combo" id="${id}" data-opt="${opt ? 1 : 0}"><button type="button" class="cb-btn" data-act="cb-toggle" data-id="${id}" aria-haspopup="listbox" aria-expanded="false"></button><div class="cb-pop" hidden><input class="cb-q" type="search" placeholder="ابحث برقم الطلب أو المصنع…" aria-label="بحث"><div class="cb-list" role="listbox"></div></div></div>`;
}
const CHEV =
  '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
function comboPaint(id) {
  const c = document.getElementById(id);
  if (!c) return;
  const o = WS.ord && byId('orders', WS.ord);
  c.querySelector('.cb-btn').innerHTML =
    (o
      ? `<span class="nm"><b>${esc(o.ref)} · ${esc(factoryName(o.factoryId))}</b><small>${ordRem(o) > 0 ? 'المتبقي ' + num(ordRem(o)) + ' ' + (CUR[o.currency] || '') : 'مدفوع بالكامل'}</small></span>`
      : `<span class="nm"><b style="color:var(--mute)">${c.dataset.opt === '1' ? 'بدون طلب' : 'اختر الطلب'}</b><small>${c.dataset.opt === '1' ? 'اختياري' : 'ابحث برقم الطلب أو اسم المصنع'}</small></span>`) +
    CHEV;
}
function comboList(id) {
  const c = document.getElementById(id);
  const q = c.querySelector('.cb-q').value.trim().toLowerCase();
  const items = S.orders
    .map(o => ({ o, rem: ordRem(o), f: factoryName(o.factoryId) }))
    .filter(x => !q || (x.o.ref || '').toLowerCase().includes(q) || x.f.toLowerCase().includes(q))
    .sort((a, b) => (b.rem > 0) - (a.rem > 0) || (b.o.orderDate || '').localeCompare(a.o.orderDate || ''));
  const none =
    c.dataset.opt === '1' && !q
      ? `<button type="button" class="cb-it" data-act="cb-pick" data-id="" aria-selected="${!WS.ord}"><span class="nm"><b>بدون طلب</b></span></button>`
      : '';
  c.querySelector('.cb-list').innerHTML =
    none +
    (items
      .map(
        x =>
          `<button type="button" class="cb-it" role="option" data-act="cb-pick" data-id="${x.o.id}" aria-selected="${x.o.id === WS.ord}"><span class="nm"><b>${esc(x.o.ref)} · ${esc(x.f)}</b><small>${fmtD(x.o.orderDate)}</small></span><span class="am ${x.rem > 0 ? '' : 'done'}">${x.rem > 0 ? num(x.rem) + ' ' + (CUR[x.o.currency] || '') : '✓ مدفوع'}</span></button>`
      )
      .join('') || '<div class="cb-empty">ما لكيت طلب</div>');
}
function comboToggle(id, open) {
  const c = document.getElementById(id);
  if (!c) return;
  const pop = c.querySelector('.cb-pop');
  open = open === undefined ? pop.hidden : open;
  pop.hidden = !open;
  c.classList.toggle('open', open);
  c.querySelector('.cb-btn').setAttribute('aria-expanded', open);
  if (open) {
    c.querySelector('.cb-q').value = '';
    comboList(id);
    setTimeout(() => c.querySelector('.cb-q').focus(), 30);
  }
}
function wHint() {
  const h = $('#wHint');
  if (!h) return;
  const f = $('#mform');
  if (WS.kind === 'in') {
    const lb = $('#wAmtL');
    if (lb) lb.textContent = WS.ist === 'wait' ? 'كم راح يسجلون؟ (اختياري، تكتبه وقت توصل)' : 'كم سجلوا لك؟';
    if (WS.ist === 'wait' && !num2(f.elements.wAmt.value)) {
      h.textContent = 'الحوالة تنحفظ بالانتظار وما تنحسب بالرصيد لحد ما تأكد وصولها.';
      return;
    }
    const p = num2(f.elements.wPaid.value),
      a = num2(f.elements.wAmt.value);
    h.textContent =
      p && a
        ? rateTxt({ paid: p, amt: a, payCur: WS.pc, cur: WS.cur }) || ''
        : 'اكتب كم دفعت وكم سجلوا لك، والنظام يحسب سعر اليوان عليك.';
    return;
  }
  if (WS.kind === 'pay') {
    const o = WS.ord && byId('orders', WS.ord);
    if (!o) {
      h.textContent = '';
      return;
    }
    const a = num2(f.elements.wAmt.value),
      rem = ordRem(o);
    if (!WS.car) {
      h.textContent =
        'دفع مباشر للمصنع · المتبقي للطلب ' +
        num(rem) +
        ' ' +
        (CUR[o.currency] || '') +
        (a > rem + 0.005 ? ' · المبلغ أكبر من المتبقي' : '');
      return;
    }
    const b = walletBal(WS.car)[o.currency] || 0;
    h.textContent =
      (b >= 0 ? 'رصيدك عند الشركة ' + num(b) : 'انت مطلوب لهم ' + num(-b)) +
      ' ' +
      (CUR[o.currency] || '') +
      ' · المتبقي للطلب ' +
      num(rem) +
      (a > rem + 0.005 ? ' · المبلغ أكبر من المتبقي' : '') +
      (a > Math.max(b, 0) + 0.005 ? ' · بعدها تصير مطلوب لهم ' + num(r2(a - b)) : '');
  }
}
function schedForm(orderId) {
  const o = byId('orders', orderId);
  if (!o) return;
  const rem = ordRem(o),
    sched = S.payments.filter(p => p.orderId === o.id && !p.paid).reduce((a, p) => a + (+p.amount || 0), 0),
    left = r2(Math.max(rem - sched, 0));
  const body = `<input type="hidden" name="orderId" value="${esc(o.id)}"><div class="hint">الطلب ${esc(o.ref)} · المتبقي ${money(rem, o.currency)}${sched ? ' · منه مجدول ' + money(sched, o.currency) : ''}</div>
  ${fld('المبلغ (' + (CUR[o.currency] || '') + ')', inp('amount', left || '', 'number', 'required'))}
  <div class="chips">${[30, 50].map(x => `<button type="button" class="chip" data-act="pct" data-pct="${x}">${x}%</button>`).join('')}<button type="button" class="chip" data-act="sp-all" data-v="${left}">الباقي كله</button></div>
  ${fld(
    'موعدها بعد',
    inp('dueDate', addDays(todayISO(), 30), 'date') +
      '<div class="chips qd">' +
      [
        [7, 'أسبوع'],
        [15, '15 يوم'],
        [30, 'شهر'],
        [60, 'شهرين']
      ]
        .map(x => `<button type="button" class="chip" data-act="due" data-d="${x[0]}">${x[1]}</button>`)
        .join('') +
      '</div>'
  )}
  ${fld('وصف (اختياري)', inp('label', '', 'text', 'placeholder="مثلاً: قبل الشحن"'))}
  <p class="hint">يطلعلك تنبيه من يكرب موعدها، وتسددها بضغطة من الطلب أو من الرئيسية.</p>`;
  openModal('موعد دفعة', body, {
    back: () => openOrder(orderId),
    onSubmit: async f => {
      const amount = r2(num2(f.elements.amount.value)),
        due = val(f, 'dueDate');
      if (!(amount > 0)) {
        ferr('اكتب المبلغ', 'amount');
        return;
      }
      if (!due) {
        ferr('حدد الموعد', 'dueDate');
        return;
      }
      if (itemsTotal(o) > 0 && r2(sched + amount) > rem + 0.005) {
        ferr('المبلغ مع المجدول يتجاوز المتبقي على الطلب (' + num(rem) + ')', 'amount');
        return;
      }
      await put('payments', {
        id: newId('payments'),
        createdAt: Date.now(),
        orderId: o.id,
        label: val(f, 'label'),
        amount,
        dueDate: due,
        paid: false,
        paidDate: '',
        method: '',
        via: '',
        note: ''
      });
      closeModal();
      toast('تم حفظ موعد الدفعة');
    }
  });
}
function settleForm(pid) {
  const p = byId('payments', pid);
  if (!p) return;
  const o = byId('orders', p.orderId);
  WS = {
    kind: 'settle',
    car: WCAR && byId('carriers', WCAR) ? WCAR : S.carriers[0] ? S.carriers[0].id : '',
    ord: p.orderId
  };
  const body = `<div class="hint">${esc(p.label || 'دفعة')} · الطلب ${esc(o ? o.ref : '—')} · <b>${money(p.amount, o && o.currency)}</b></div>${wCarPick(true)}${fld('تاريخ الدفع', inp('wDate', todayISO(), 'date'))}`;
  openModal('تسديد دفعة', body, {
    back: M.el && o ? () => openOrder(o.id) : null,
    onSubmit: async f => {
      const date = val(f, 'wDate') || todayISO();
      if (date > todayISO()) {
        ferr('تاريخ الدفع لا يمكن أن يكون في المستقبل', 'wDate');
        return;
      }
      const car = WS.car && byId('carriers', WS.car);
      await put(
        'payments',
        Object.assign({}, p, {
          paid: true,
          paidDate: date,
          via: car ? car.id : '',
          method: car ? 'عن طريق ' + car.name : 'مباشر'
        })
      );
      if (car) WCAR = car.id;
      closeModal();
      toast('تم تسجيل التسديد');
    }
  });
}
function walletForm(kind, orderId) {
  if (!S.carriers.length && kind !== 'pay') {
    toast('أضف شركة شحن أولاً', 'bad');
    return;
  }
  WS = {
    kind,
    car: WCAR && byId('carriers', WCAR) ? WCAR : S.carriers[0] ? S.carriers[0].id : '',
    ord: orderId || null,
    pc: 'IQD',
    cur: 'CNY',
    pm: 'part',
    ft: 'شحن',
    ist: 'ok',
    rc: null
  };
  const back = orderId ? () => openOrder(orderId) : null;
  const seg = (name, opts, v) =>
    `<div class="chips" role="group">${opts.map(o => `<button type="button" class="chip" data-act="w-seg" data-k="${name}" data-v="${o[0]}" aria-pressed="${o[0] === v}">${o[1]}</button>`).join('')}</div>`;
  let body = wCarPick(kind === 'pay'),
    title = '';
  if (kind === 'in') {
    title = 'أرسلت فلوس لشركة الشحن';
    body += `<div class="fld"><span>الحوالة</span>${seg(
      'ist',
      [
        ['ok', 'وصلت · حوالة سريعة'],
        ['wait', 'بالانتظار']
      ],
      'ok'
    )}</div>${fld('كم دفعت بالعراق؟', inp('wPaid', '', 'number'))}${seg(
      'pc',
      [
        ['IQD', 'دينار'],
        ['USD', 'دولار']
      ],
      'IQD'
    )}<label class="fld" id="wAmtF"><span id="wAmtL">كم سجلوا لك؟</span>${inp('wAmt', '', 'number')}</label>${seg(
      'cur',
      [
        ['CNY', 'يوان ¥'],
        ['USD', 'دولار $']
      ],
      'CNY'
    )}${fld('التاريخ', inp('wDate', todayISO(), 'date'))}<div class="fld"><span>صورة الوصل (اختياري)</span><div class="rcrow"><label class="btn ghost sm filebtn">${ico('up', 15)} صورة الوصل<input type="file" id="wRcpt" accept="image/*,.pdf" class="vh"></label><span id="wRcptPrev"></span></div></div>${fld('ملاحظة', inp('wNote', ''))}<p class="hint" id="wHint"></p>`;
  } else if (kind === 'pay') {
    title = 'شركة الشحن دفعت لمصنع';
    body += `<div class="fld"><span>الطلب</span>${comboHTML('cbOrd')}</div>${seg(
      'pm',
      [
        ['full', 'دفعة كاملة'],
        ['part', 'دفعة جزئية']
      ],
      'part'
    )}${fld('المبلغ (بعملة الطلب)', inp('wAmt', '', 'number'))}<div class="chips" id="wPct">${[30, 50, 70].map(x => `<button type="button" class="chip" data-act="w-pct" data-v="${x}">${x}%</button>`).join('')}</div>${fld('تاريخ الدفع', inp('wDate', todayISO(), 'date'))}<p class="hint" id="wHint"></p>`;
  } else {
    title = 'شحن ونقل';
    body += `${seg(
      'ft',
      [
        ['شحن', 'أجور شحن'],
        ['نقل', 'نقل من المصنع'],
        ['أخرى', 'أخرى']
      ],
      'شحن'
    )}<div class="fld"><span>الطلب (اختياري)</span>${comboHTML('cbOrd', true)}</div>${fld('المبلغ', inp('wAmt', '', 'number'))}${seg(
      'cur',
      [
        ['CNY', 'يوان ¥'],
        ['USD', 'دولار $']
      ],
      'CNY'
    )}${fld('التاريخ', inp('wDate', todayISO(), 'date'))}${fld('ملاحظة', inp('wNote', '', 'text', 'placeholder="مثلاً شحنة بحرية 08"'))}`;
  }
  openModal(title, body, {
    back,
    onOpen: f => {
      comboPaint('cbOrd');
      wHint();
      const rc = $('#wRcpt');
      if (rc)
        rc.addEventListener('change', async ev => {
          const fl = ev.target.files[0];
          ev.target.value = '';
          if (!fl) return;
          try {
            WS.rc = await prepFile(fl);
            $('#wRcptPrev').innerHTML =
              (WS.rc.thumb ? `<img class="rcth" src="${WS.rc.thumb}" alt="">` : '') +
              `<small>${esc(WS.rc.name)}</small>`;
          } catch (e) {
            toast('الملف كبير أو غير مدعوم', 'bad');
          }
        });
      f.addEventListener('input', e => {
        if (e.target.classList.contains('cb-q')) comboList(e.target.closest('.combo').id);
        else wHint();
      });
    },
    onSubmit: async f => {
      const amt = r2(num2(f.elements.wAmt.value)),
        date = val(f, 'wDate') || todayISO();
      const wait = kind === 'in' && WS.ist === 'wait';
      if (!(amt > 0) && !wait) {
        ferr('اكتب المبلغ', 'wAmt');
        return;
      }
      if (kind === 'in') {
        const paid = r2(num2(f.elements.wPaid.value));
        if (!(paid > 0)) {
          ferr('اكتب كم دفعت', 'wPaid');
          return;
        }
        const id = newId('ctx'),
          files = [];
        if (WS.rc) {
          try {
            const fid = newId('files');
            await writeFileDoc(fid, {
              orderId: '',
              ctxId: id,
              companyId: ACTIVE,
              name: WS.rc.name,
              type: WS.rc.type,
              size: WS.rc.size,
              data: WS.rc.data
            });
            files.push({ id: fid, name: WS.rc.name, type: WS.rc.type, size: WS.rc.size, thumb: WS.rc.thumb || '' });
          } catch (e) {
            ferr('تعذر حفظ صورة الوصل');
            return;
          }
        }
        await put('ctx', {
          id,
          type: 'in',
          status: wait ? 'wait' : 'ok',
          carrierId: WS.car,
          paid,
          payCur: WS.pc,
          amt: amt > 0 ? amt : 0,
          cur: WS.cur,
          date,
          sentDate: date,
          files,
          note: val(f, 'wNote'),
          at: Date.now()
        });
      } else if (kind === 'pay') {
        const o = WS.ord && byId('orders', WS.ord);
        if (!o) {
          ferr('اختر الطلب');
          return;
        }
        const car = WS.car && byId('carriers', WS.car);
        const rem = ordRem(o);
        if (itemsTotal(o) > 0 && amt > rem + 0.005) {
          ferr('المبلغ أكبر من المتبقي على الطلب (' + num(rem) + ' ' + (CUR[o.currency] || '') + ')', 'wAmt');
          return;
        }
        await put('payments', {
          id: newId('payments'),
          createdAt: Date.now(),
          orderId: o.id,
          label: WS.pm === 'full' ? 'دفعة كاملة' : '',
          amount: amt,
          dueDate: date,
          paid: true,
          paidDate: date,
          method: car ? 'عن طريق ' + car.name : 'مباشر',
          via: car ? car.id : '',
          note: ''
        });
      } else
        await put('ctx', {
          id: newId('ctx'),
          type: 'fee',
          ft: WS.ft,
          carrierId: WS.car,
          orderId: WS.ord || '',
          amt,
          cur: WS.cur,
          date,
          note: val(f, 'wNote'),
          at: Date.now()
        });
      if (WS.car) WCAR = WS.car;
      closeModal();
      toast('تم الحفظ');
    }
  });
}
