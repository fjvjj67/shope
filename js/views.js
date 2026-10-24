/* Pages: order detail, dashboard, lists */
const NEXT = {
  production: ['ready', 'تحديد كجاهز للشحن'],
  ready: ['shipped', 'تحديد كمشحون'],
  shipped: ['received', 'تحديد كمستلم']
};
function openOrder(id) {
  const draw = () => {
    const o = byId('orders', id);
    if (!o) {
      closeModal(true);
      return '';
    }
    const i = oi(o);
    const items = (o.items || [])
      .map(
        x =>
          `<tr><td data-label="المنتج">${esc(x.name)}</td><td class="n" data-label="الكمية">${num(x.qty)}</td><td class="n" data-label="السعر">${money(x.price, o.currency)}</td><td class="n" data-label="الإجمالي">${money(x.qty * x.price, o.currency)}</td></tr>`
      )
      .join('');
    const plan = payPlan(o);
    const pays = plan
      .map(x => {
        const p = x.p;
        return `<li><div class="t"><b>${ordName(x.n)} · ${money(p.amount, o.currency)}${p.label ? ' <small>(' + esc(p.label) + ')</small>' : ''}</b><small>${p.paid ? 'سُدّدت ' + fmtD(p.paidDate) : 'تستحق ' + fmtD(p.dueDate)}${p.method ? ' · ' + esc(p.method) : ''} · يتبقى بعدها ${money(Math.max(x.after, 0), o.currency)}</small></div><div class="r">${p.paid ? pill('ok', 'مدفوعة') : pill(dueKind(p.dueDate), dueText(p.dueDate))}
      ${p.paid ? '' : `<button class="btn sm" data-act="pay-now" data-id="${p.id}">تسديد</button>`}<button class="icon" data-act="edit-payment" data-id="${p.id}" aria-label="تعديل">${ico('edit', 16)}</button></div></li>`;
      })
      .join('');
    const pp = i.total ? Math.min(100, (i.paid / i.total) * 100) : 0,
      ps = i.total ? Math.min(100 - pp, (i.scheduled / i.total) * 100) : 0;
    const ships = S.shipments
      .filter(s => s.orderId === id)
      .map(
        s =>
          `<li><div class="t"><b>${esc(s.ref)}</b><small>${esc((byId('carriers', s.carrierId) || {}).name || '—')} · وصول ${fmtD(s.eta)}</small></div><div class="r">${pill(SHIP_K[s.status], shipName(s.status))} <button class="icon" data-act="edit-shipment" data-id="${s.id}" aria-label="تعديل">${ico('edit', 16)}</button></div></li>`
      )
      .join('');
    return `<div class="bar">${pill(STAGE_K[o.stage], stageName(o.stage))}${i.timing ? pill(i.timing.k, 'التجهيز: ' + i.timing.t) : ''}${i.recv ? pill(i.recv.k, 'الاستلام: ' + i.recv.t) : ''}${pill(i.pay[0], 'الدفع: ' + i.pay[1])}<span style="color:var(--mute)">${esc(factoryName(o.factoryId))} · ${fmtD(o.orderDate)}</span></div>
    <div class="kv"><div><small>الإجمالي</small><b>${money(i.total, o.currency)}</b></div><div><small>المدفوع</small><b>${money(i.paid, o.currency)}</b></div><div><small>المتبقي للمصنع</small><b>${money(i.remaining, o.currency)}</b></div><div><small>مجدول غير مدفوع</small><b>${money(i.scheduled, o.currency)}</b></div><div><small>موعد التجهيز</small><b>${fmtD(o.prepDate)}</b></div>${o.recvDate ? `<div><small>موعد الاستلام</small><b>${fmtD(o.recvDate)}</b></div>` : ''}</div>
    <div><div class="prog" role="img" aria-label="نسبة المدفوع ${Math.round(pp)} بالمئة"><i class="p1" style="width:${pp}%"></i><i class="p2" style="width:${ps}%"></i></div><div class="legend" style="margin-top:6px"><span><b style="background:var(--ok)"></b>مدفوع <bdi>${Math.round(pp)}%</bdi></span><span><b style="background:var(--warn)"></b>مجدول <bdi>${Math.round(ps)}%</bdi></span><span><b style="background:var(--glass-2)"></b>غير مجدول</span></div></div>
    ${items ? `<div class="scroll"><table class="tbl"><thead><tr><th>المنتج</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">الإجمالي</th></tr></thead><tbody>${items}</tbody></table></div>` : ''}
    <div><h3 style="margin-bottom:6px">الدفعات <span class="acts"><button class="btn ghost sm" data-act="sched-pay" data-order="${id}">${ico('clock', 14)} موعد دفعة</button><button class="btn sm" data-act="pay-order" data-order="${id}">${ico('plus', 14)} دفع الآن</button></span></h3><ul class="list">${pays || '<li style="color:var(--mute)">لا توجد دفعات مسجّلة</li>'}</ul></div>
    <div><h3 style="margin-bottom:6px">الشحنات <button class="btn ghost sm" data-act="new-shipment" data-order="${id}">${ico('plus', 14)} شحنة</button></h3><ul class="list">${ships || '<li style="color:var(--mute)">لا توجد شحنات مرتبطة</li>'}</ul></div>
    ${attSection(o)}
    ${o.note ? `<div class="hint">${esc(o.note)}</div>` : ''}
    <div class="mf"><button class="btn ghost" type="button" data-act="del-ask" data-col="orders" data-id="${id}">${ico('trash', 16)} حذف</button>${NEXT[o.stage] ? `<button class="btn ghost" type="button" data-act="next-stage" data-id="${id}">${ico('check', 16)} ${NEXT[o.stage][1]}</button>` : ''}<button class="btn" type="button" data-act="edit-order" data-id="${id}">${ico('edit', 16)} تعديل الطلب</button></div>`;
  };
  const mount = () => {
    const o = byId('orders', id);
    if (!o) return;
    openModal('طلب ' + (o.ref || ''), draw(), {
      wide: true,
      refresh: () => {
        const f = $('#mform');
        if (f) {
          const h = draw();
          if (h) f.innerHTML = h;
        }
      }
    });
  };
  mount();
}

/* ---------- views ---------- */
const FL = { orders: { q: '', st: '' }, payments: { q: '', st: '' }, shipments: { q: '', st: '' } };
const toolbar = (key, opts) =>
  `<div class="bar card" style="padding:12px"><div class="grow field-s"><input id="q_${key}" type="search" placeholder="بحث سريع…" value="${esc(FL[key].q)}" aria-label="بحث"></div><select id="s_${key}" aria-label="تصفية" style="max-width:200px">${opts.map(o => `<option value="${o[0]}"${FL[key].st === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div><div class="card scroll" id="list"></div>`;
const empty = (t, s, cta) => `<div class="empty"><b>${t}</b><span>${s}</span>${cta || ''}</div>`;

function ordersList() {
  const q = FL.orders.q.trim().toLowerCase(),
    st = FL.orders.st;
  let rows = S.orders
    .map(o => ({ o, i: oi(o) }))
    .filter(r => {
      if (st === 'open' && r.o.stage === 'received') return false;
      if (st === 'late' && !(r.i.timing && r.i.timing.k === 'bad')) return false;
      if (st === 'recv' && !(r.i.recv && r.i.recv.k !== 'ok')) return false;
      if (st === 'unpaid' && r.i.remaining <= 0.001) return false;
      if (['production', 'ready', 'shipped', 'received'].includes(st) && r.o.stage !== st) return false;
      if (q) {
        const hay = (
          r.o.ref +
          ' ' +
          factoryName(r.o.factoryId) +
          ' ' +
          (r.o.note || '') +
          ' ' +
          (r.o.items || []).map(x => x.name).join(' ')
        ).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.o.orderDate || '').localeCompare(a.o.orderDate || ''));
  if (!S.orders.length)
    return empty(
      'لا توجد طلبات بعد',
      'سجّل أول طلب مع المصنع ومبلغه ومواعيده.',
      `<button class="btn" data-act="new-order">${ico('plus')} طلب جديد</button>`
    );
  if (!rows.length) return empty('لا نتائج', 'غيّر البحث أو التصفية.');
  return `<div class="ocards">${rows
    .map(r => {
      const t = r.i.total,
        pp = t ? Math.min(100, (r.i.paid / t) * 100) : 0,
        ps = t ? Math.min(100 - pp, (r.i.scheduled / t) * 100) : 0,
        done = t && r.i.remaining <= 0.001;
      const nf = (r.o.files || []).length;
      return `<button type="button" class="ocard${done ? ' done' : ''}" data-act="open-order" data-id="${r.o.id}">
     <div class="oc-h"><div class="oc-t"><b>${esc(r.o.ref || 'بدون رقم')}</b><small>${esc(factoryName(r.o.factoryId))} · ${fmtD(r.o.orderDate)}${nf ? ' · 📎 ' + nf : ''}</small></div>${pill(STAGE_K[r.o.stage], stageName(r.o.stage))}</div>
     <div class="oc-m"><div><small>${done ? 'مدفوع بالكامل' : t ? 'المتبقي للمصنع' : 'بدون مبلغ'}</small><b class="${done ? 'ok' : ''}">${t ? money(done ? t : r.i.remaining, r.o.currency) : '—'}</b></div>${pill(r.i.pay[0], r.i.pay[1])}</div>
     <div class="zbar oc-bar" role="img" aria-label="مدفوع ${Math.round(pp)} بالمئة"><i class="p" style="width:${pp}%"></i><i class="s" style="width:${ps}%"></i></div>
     <div class="oc-f"><span>الإجمالي <b>${t ? money(t, r.o.currency) : '—'}</b></span><span>مدفوع <b>${money(r.i.paid, r.o.currency)}</b></span>${r.i.scheduled ? `<span>مجدول <b>${money(r.i.scheduled, r.o.currency)}</b></span>` : ''}${r.o.prepDate && r.o.stage === 'production' ? `<span>التجهيز ${r.i.timing && r.i.timing.k !== 'ok' ? pill(r.i.timing.k, r.i.timing.t) : '<b>' + fmtD(r.o.prepDate) + '</b>'}</span>` : ''}</div>
    </button>`;
    })
    .join('')}</div>`;
}
function payStatus(p) {
  if (p.paid) return ['ok', 'مدفوعة'];
  if (!p.dueDate) return ['mute', 'بدون موعد'];
  const d = diffDays(p.dueDate);
  return d < 0 ? ['bad', 'متأخرة'] : d <= 7 ? ['warn', 'قريبة'] : ['info', 'مجدولة'];
}
function paymentsList() {
  const q = FL.payments.q.trim().toLowerCase(),
    st = FL.payments.st;
  const planOf = {};
  S.orders.forEach(o => {
    planOf[o.id] = payPlan(o);
  });
  const info = p => {
    const pl = planOf[p.orderId] || [];
    return pl.find(x => x.p.id === p.id) || { n: 1, after: 0, cum: 0 };
  };
  const all = S.payments.map(p => ({
    p,
    o: byId('orders', p.orderId),
    s: payStatus(p),
    x: info(p),
    cnt: (planOf[p.orderId] || []).length
  }));
  let rows = all
    .filter(r => {
      if (st === 'unpaid' && r.p.paid) return false;
      if (st === 'paid' && !r.p.paid) return false;
      if (st === 'late' && r.s[1] !== 'متأخرة') return false;
      if (st === 'soon' && r.s[1] !== 'قريبة') return false;
      if (q) {
        const hay = ((r.p.label || '') + ' ' + orderLabel(r.o) + ' ' + (r.p.note || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        a.p.paid - b.p.paid ||
        (a.p.paid
          ? (b.p.paidDate || '').localeCompare(a.p.paidDate || '')
          : (a.p.dueDate || '9').localeCompare(b.p.dueDate || '9'))
    );
  if (!S.payments.length)
    return empty(
      'لا توجد دفعات',
      'سجّل الدفعات المجدولة والمسدّدة لكل طلب.',
      `<button class="btn" data-act="new-payment">${ico('plus')} دفعة جديدة</button>`
    );
  const sPaid = {},
    sSched = {},
    sLate = {};
  all.forEach(r => {
    const c = r.o && r.o.currency,
      a = +r.p.amount || 0;
    if (r.p.paid) addTo(sPaid, c, a);
    else {
      addTo(sSched, c, a);
      if (r.s[1] === 'متأخرة') addTo(sLate, c, a);
    }
  });
  const sum = `<div class="kv" style="margin-bottom:12px"><div><small>مدفوع إجمالاً</small><b>${multi(sPaid)}</b></div><div><small>مجدول غير مدفوع</small><b>${multi(sSched)}</b></div><div><small>متأخر</small><b style="color:${Object.keys(sLate).some(c => sLate[c] > 0) ? 'var(--bad)' : 'inherit'}">${multi(sLate)}</b></div></div>`;
  if (!rows.length) return sum + empty('لا نتائج', 'غيّر البحث أو التصفية.');
  return (
    sum +
    `<table class="tbl"><thead><tr><th>الطلب</th><th>الدفعة</th><th class="n">المبلغ</th><th class="n">يتبقى بعدها</th><th>الاستحقاق</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td data-label="الطلب"><button class="link" data-act="open-order" data-id="${r.p.orderId}"><b>${esc(r.o ? r.o.ref : '—')}</b><br><small style="color:var(--mute)">${esc(r.o ? factoryName(r.o.factoryId) : '')}</small></button></td><td data-label="الدفعة"><b>${ordName(r.x.n)}</b> <small style="color:var(--mute)">من ${r.cnt}</small>${r.p.label ? '<br><small style="color:var(--mute)">' + esc(r.p.label) + '</small>' : ''}</td><td class="n" data-label="المبلغ">${money(r.p.amount, r.o && r.o.currency)}</td><td class="n" data-label="يتبقى بعدها">${money(Math.max(r.x.after, 0), r.o && r.o.currency)}</td><td data-label="الاستحقاق">${r.p.paid ? 'سُدّدت ' + fmtD(r.p.paidDate) : fmtD(r.p.dueDate) + '<br><small style="color:var(--mute)">' + dueText(r.p.dueDate) + '</small>'}</td><td data-label="الحالة">${pill(r.s[0], r.s[1])}</td><td class="nolab"><div class="acts">${r.p.paid ? '' : `<button class="btn sm" data-act="pay-now" data-id="${r.p.id}">تسديد</button>`}<button class="icon" data-act="edit-payment" data-id="${r.p.id}" aria-label="تعديل">${ico('edit', 16)}</button><button class="icon" data-act="del-ask" data-col="payments" data-id="${r.p.id}" aria-label="حذف">${ico('trash', 16)}</button></div></td></tr>`).join('')}</tbody></table>`
  );
}
function shipmentsList() {
  const q = FL.shipments.q.trim().toLowerCase(),
    st = FL.shipments.st;
  let rows = S.shipments
    .map(s => ({ s, c: byId('carriers', s.carrierId), o: byId('orders', s.orderId) }))
    .filter(r => {
      if (st && r.s.status !== st && !(st === 'unpaid' && shipRemaining(r.s) > 0.001)) return false;
      if (st === 'unpaid' && shipRemaining(r.s) <= 0.001) return false;
      if (q) {
        const hay = (
          r.s.ref +
          ' ' +
          (r.c ? r.c.name : '') +
          ' ' +
          orderLabel(r.o) +
          ' ' +
          (r.s.note || '')
        ).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        (a.s.status === 'arrived') - (b.s.status === 'arrived') || (a.s.eta || '9').localeCompare(b.s.eta || '9')
    );
  if (!S.shipments.length)
    return empty(
      'لا توجد شحنات',
      'اربط كل شحنة بالطلب وشركة الشحن لمتابعة التكلفة والوصول.',
      `<button class="btn" data-act="new-shipment">${ico('plus')} شحنة جديدة</button>`
    );
  if (!rows.length) return empty('لا نتائج', 'غيّر البحث أو التصفية.');
  const NX = { preparing: 'انطلقت ←', transit: 'وصلت ✓' };
  return `<table class="tbl"><thead><tr><th>الشحنة</th><th>الطلب</th><th class="n">أجور الشحن</th><th>الوصول المتوقع</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td data-label="الشحنة"><b>${esc(r.s.ref)}</b><br><small style="color:var(--mute)">${esc(r.c ? r.c.name : '—')}</small></td><td data-label="الطلب">${r.o ? `<button class="link" data-act="open-order" data-id="${r.o.id}">${esc(orderLabel(r.o))}</button>` : '—'}</td><td class="n" data-label="أجور الشحن">${money(r.s.cost, r.s.currency)}</td><td data-label="الوصول المتوقع">${fmtD(r.s.eta)}${r.s.status !== 'arrived' && r.s.eta ? '<br><small style="color:var(--mute)">' + dueText(r.s.eta) + '</small>' : ''}</td><td data-label="الحالة">${pill(SHIP_K[r.s.status], shipName(r.s.status))}</td><td class="nolab"><div class="acts">${NX[r.s.status] ? `<button class="btn sm" data-act="ship-next" data-id="${r.s.id}">${NX[r.s.status]}</button>` : ''}<button class="icon" data-act="edit-shipment" data-id="${r.s.id}" aria-label="تعديل">${ico('edit', 16)}</button><button class="icon" data-act="del-ask" data-col="shipments" data-id="${r.s.id}" aria-label="حذف">${ico('trash', 16)}</button></div></td></tr>`).join('')}</tbody></table>`;
}
const LISTS = { orders: ordersList, payments: paymentsList, shipments: shipmentsList };

function forecastCard(unpaid) {
  const B = [
    ['late', 'متأخرة'],
    ['w0', 'خلال ٧ أيام'],
    ['w1', 'من ٨ إلى ١٤ يوماً'],
    ['w2', 'من ١٥ إلى ٢١ يوماً'],
    ['w3', 'من ٢٢ إلى ٢٨ يوماً'],
    ['later', 'بعد ٢٨ يوماً'],
    ['none', 'بدون موعد']
  ];
  const g = {};
  B.forEach(b => (g[b[0]] = { n: 0, s: {} }));
  unpaid.forEach(p => {
    const o = byId('orders', p.orderId);
    let k;
    if (!p.dueDate) k = 'none';
    else {
      const d = diffDays(p.dueDate);
      k = d < 0 ? 'late' : d <= 7 ? 'w0' : d <= 14 ? 'w1' : d <= 21 ? 'w2' : d <= 28 ? 'w3' : 'later';
    }
    g[k].n++;
    addTo(g[k].s, o && o.currency, +p.amount || 0);
  });
  const rows = B.filter(b => g[b[0]].n);
  return `<div class="card"><h3>توقّع الدفعات</h3><ul class="list">${rows.map(b => `<li><div class="t"><b>${b[1]}</b><small>${g[b[0]].n} دفعة</small></div><div class="r">${multi(g[b[0]].s)}</div></li>`).join('') || '<li style="color:var(--mute)">لا توجد دفعات غير مسدّدة</li>'}</ul></div>`;
}
const isoOf = ms => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
const fmtDT = ms => {
  const d = new Date(ms);
  return fmtD(isoOf(ms)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};
function dashboard() {
  const open = S.orders.filter(o => o.stage !== 'received').map(o => ({ o, i: oi(o) }));
  const late = open.filter(r => r.i.timing && r.i.timing.k === 'bad');
  const ready = open.filter(r => r.o.stage === 'ready');
  const unpaid = S.payments.filter(p => !p.paid);
  const dueSoon = unpaid.filter(p => p.dueDate && diffDays(p.dueDate) >= 0 && diffDays(p.dueDate) <= 7);
  const lateP = unpaid.filter(p => p.dueDate && diffDays(p.dueDate) < 0);
  const rem = {};
  S.orders.forEach(o => addTo(rem, o.currency, oi(o).remaining));
  const sumOf = arr => {
    const o = {};
    arr.forEach(p => {
      const ord = byId('orders', p.orderId);
      addTo(o, ord && ord.currency, +p.amount || 0);
    });
    return o;
  };
  const dueSum = sumOf(dueSoon),
    lateSum = sumOf(lateP);
  const transit = S.shipments.filter(s => s.status === 'transit');
  const carrBal = {};
  S.carriers.forEach(c => {
    const w = walletBal(c.id);
    carrBal[c.id] = {};
    Object.keys(w).forEach(k => {
      carrBal[c.id][k] = -w[k];
    });
  });
  const carrTotal = {};
  Object.values(carrBal).forEach(b => Object.keys(b).forEach(c => addTo(carrTotal, c, b[c])));
  const alerts = [];
  late.forEach(r =>
    alerts.push({
      k: 'bad',
      t: `الطلب ${r.o.ref} (${factoryName(r.o.factoryId)}) متأخر عن موعد التجهيز`,
      s: dueText(r.o.prepDate),
      act: 'open-order',
      id: r.o.id
    })
  );
  lateP.forEach(p => {
    const o = byId('orders', p.orderId);
    alerts.push({
      k: 'bad',
      t: `دفعة ${p.label || ''} للطلب ${o ? o.ref : '—'} متأخرة`,
      s: money(p.amount, o && o.currency) + ' · ' + dueText(p.dueDate),
      act: 'open-order',
      id: p.orderId
    });
  });
  unpaid
    .filter(p => p.dueDate && diffDays(p.dueDate) >= 0 && diffDays(p.dueDate) <= 3)
    .forEach(p => {
      const o = byId('orders', p.orderId);
      alerts.push({
        k: 'warn',
        t: `دفعة ${p.label || ''} للطلب ${o ? o.ref : '—'} تستحق قريباً`,
        s: money(p.amount, o && o.currency) + ' · ' + dueText(p.dueDate),
        act: 'open-order',
        id: p.orderId
      });
    });
  pendList().forEach(x => {
    const d = diffDays(x.date || todayISO());
    if (d <= -2)
      alerts.push({
        k: 'warn',
        t: 'حوالة بالانتظار: ' + num(x.paid) + ' ' + (x.payCur === 'IQD' ? 'د.ع' : '$'),
        s: 'صارلها ' + plural(-d) + ' وما أكدت وصولها',
        act: 'w-confirm',
        id: x.id
      });
  });
  S.orders
    .filter(o => o.stage === 'shipped')
    .forEach(o => {
      const ss = S.shipments.filter(s => s.orderId === o.id);
      if (ss.length && ss.every(s => s.status === 'arrived'))
        alerts.push({
          k: 'warn',
          t: `كل شحنات الطلب ${o.ref} وصلت. حدّث المرحلة إلى «مستلم»`,
          s: factoryName(o.factoryId),
          act: 'open-order',
          id: o.id
        });
    });
  transit
    .filter(s => s.eta && diffDays(s.eta) < 0)
    .forEach(s =>
      alerts.push({
        k: 'warn',
        t: `الشحنة ${s.ref} تجاوزت موعد الوصول المتوقع`,
        s: dueText(s.eta),
        act: 'edit-shipment',
        id: s.id
      })
    );
  ready
    .filter(r => !S.shipments.some(s => s.orderId === r.o.id))
    .forEach(r =>
      alerts.push({
        k: 'warn',
        t: `الطلب ${r.o.ref} جاهز للشحن ولم تُسجَّل له شحنة`,
        s: factoryName(r.o.factoryId),
        act: 'open-order',
        id: r.o.id
      })
    );
  open.forEach(r => {
    const v = r.i.recv;
    if (!v) return;
    if (v.k === 'bad')
      alerts.push({
        k: 'bad',
        t: `الطلب ${r.o.ref} تجاوز موعد الاستلام`,
        s: fmtD(r.o.recvDate) + ' · ' + v.t,
        act: 'open-order',
        id: r.o.id
      });
    else if (v.k === 'warn')
      alerts.push({
        k: 'warn',
        t: `موعد استلام الطلب ${r.o.ref} يقترب`,
        s: fmtD(r.o.recvDate) + ' · ' + v.t,
        act: 'open-order',
        id: r.o.id
      });
  });
  {
    const st = cstats(ACTIVE);
    ['USD', 'CNY'].forEach(k => {
      if (st.limit[k] && st.commit[k] > st.limit[k])
        alerts.push({
          k: 'bad',
          t: `التزامات «${coName(ACTIVE)}» تجاوزت الحد (${k === 'USD' ? '$' : '¥'})`,
          s: money(st.commit[k], k) + ' من ' + money(st.limit[k], k),
          act: 'open-company',
          id: ACTIVE
        });
    });
  }
  alerts.sort((a, b) => (a.k === 'bad' ? 0 : 1) - (b.k === 'bad' ? 0 : 1));
  const kpi = (l, v, s, k, view, st) =>
    `<button class="kpi ${k || ''}" data-act="nav" data-view="${view}" data-st="${st || ''}"><span>${l}</span><b>${v}</b><small>${s || '&nbsp;'}</small></button>`;
  const upPays = unpaid
    .slice()
    .sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'))
    .slice(0, 6);
  const upPrep = [];
  open.forEach(r => {
    if (r.o.prepDate && r.i.timing) upPrep.push({ r, d: r.o.prepDate, l: 'تجهيز', tm: r.i.timing });
    if (r.o.recvDate && r.i.recv) upPrep.push({ r, d: r.o.recvDate, l: 'استلام', tm: r.i.recv });
  });
  upPrep.sort((a, b) => a.d.localeCompare(b.d));
  upPrep.splice(6);
  const hasData = S.orders.length || S.payments.length || S.factories.length;
  const bk = META.backup,
    bAge = bk ? Math.floor((Date.now() - bk.at) / 864e5) : null;
  const nudge = '';
  const welcome =
    !S.orders.length && !S.factories.length
      ? `<div class="card"><h3>ابدأ من هنا</h3><span style="color:var(--mute)">أدخل بياناتك الحقيقية. لا توجد أسماء أو أرقام جاهزة في النظام.</span><ol class="steps"><li><b>١. المصانع</b>أضف المصانع التي تتعامل معها.</li><li><b>٢. الطلبات</b>سجّل الطلب ومبلغه ومواعيده.</li><li><b>٣. شركات الشحن</b>سجّل الفلوس اللي ترسلها، وهي تدفع منها للمصانع.</li><li><b>٤. الشحنات</b>اربط كل شحنة بالطلب وتابع وصولها.</li></ol><div class="bar" style="margin-top:12px"><button class="btn" data-act="new-factory">${ico('plus')} أضف أول مصنع</button><button class="btn ghost" data-act="demo-load">تحميل بيانات تجريبية للتعرف على النظام</button></div></div>`
      : '';
  const zt = {},
    zp = {},
    zs = {};
  S.orders.forEach(o => {
    const i = oi(o);
    addTo(zt, o.currency, i.total);
    addTo(zp, o.currency, i.paid);
    addTo(zs, o.currency, i.scheduled);
  });
  const zc =
    Object.keys(zt)
      .filter(k => zt[k] > 0)
      .sort((a, b) => (b === 'CNY') - (a === 'CNY'))[0] || 'CNY';
  const zT = zt[zc] || 0,
    zP = zp[zc] || 0,
    zS = zs[zc] || 0,
    zpp = zT ? Math.min(100, (zP / zT) * 100) : 0,
    zsp = zT ? Math.min(100 - zpp, (zS / zT) * 100) : 0;
  const zOther = Object.keys(zt)
    .filter(k => k !== zc && zt[k] > 0)
    .map(k => money(r2(zt[k] - (zp[k] || 0)), k))
    .join(' · ');
  const zhero = `<section class="zhero"><span class="zl">المتبقي للمصانع</span><div class="zbig">${num(r2(zT - zP))}<small>${CUR[zc] || zc}</small></div><div class="zbar" role="img" aria-label="مدفوع ${Math.round(zpp)} بالمئة"><i class="p" style="width:${zpp}%"></i><i class="s" style="width:${zsp}%"></i></div><div class="zsub"><span>مدفوع <b>${money(zP, zc)}</b></span><span>من <b>${money(zT, zc)}</b></span></div>${zOther ? `<div class="zsub"><span>وبعملة ثانية: <b>${zOther}</b></span></div>` : ''}</section>`;
  return `${nudge}<div class="dash">
  <div class="d-hero">${zhero}</div>
  ${carriersView(true)}
  <div class="kpis d-kpis">
    ${kpi('طلبات مفتوحة', open.length, 'لم تُستلم بعد', '', 'orders', 'open')}
    ${kpi('طلبات متأخرة', late.length, 'عن موعد التجهيز', late.length ? 'bad' : '', 'orders', 'late')}
    ${kpi('جاهزة للشحن', ready.length, 'بانتظار شحنة', ready.length ? 'warn' : '', 'orders', 'ready')}
    ${kpi('شحنات بالطريق', transit.length, 'قيد النقل', '', 'shipments', 'transit')}
  </div>
  <div class="d-side">
    <div class="card"><h3>التنبيهات ${alerts.length ? pill('bad', alerts.length) : ''}</h3><ul class="list">${
      alerts
        .slice(0, 8)
        .map(
          a =>
            `<li><div class="t"><button class="link" data-act="${a.act}" data-id="${a.id}"><b>${esc(a.t)}</b></button><small>${a.s}</small></div>${pill(a.k, a.k === 'bad' ? 'عاجل' : 'انتبه')}</li>`
        )
        .join('') || '<li style="color:var(--mute)">لا توجد تنبيهات حالياً</li>'
    }</ul></div>
    <div class="card"><h3>الدفعات القادمة</h3><ul class="list">${
      upPays
        .map(p => {
          const o = byId('orders', p.orderId);
          return `<li><div class="t"><button class="link" data-act="open-order" data-id="${p.orderId}"><b>${esc(p.label || 'دفعة')} · ${esc(o ? o.ref : '—')}</b></button><small>${esc(o ? factoryName(o.factoryId) : '')} · ${fmtD(p.dueDate)}</small></div><div class="r">${money(p.amount, o && o.currency)}<br>${pill(dueKind(p.dueDate), dueText(p.dueDate))} <button class="btn sm" data-act="pay-now" data-id="${p.id}">سدّد</button></div></li>`;
        })
        .join('') || '<li style="color:var(--mute)">لا توجد دفعات غير مسدّدة</li>'
    }</ul></div>
  </div>
  <div class="d-more">
    <div class="card"><h3>المواعيد القادمة <button class="btn ghost sm" data-act="nav" data-view="orders">الطلبات</button></h3><ul class="list">${upPrep.map(x => `<li><div class="t"><button class="link" data-act="open-order" data-id="${x.r.o.id}"><b>${esc(x.r.o.ref)} · ${x.l}</b></button><small>${esc(factoryName(x.r.o.factoryId))} · ${fmtD(x.d)}</small></div><div class="r">${pill(x.tm.k, x.tm.t)}</div></li>`).join('') || '<li style="color:var(--mute)">لا توجد مواعيد قادمة</li>'}</ul></div>
    <div class="card"><h3>شحنات بالطريق <button class="btn ghost sm" data-act="nav" data-view="shipments">الكل</button></h3><ul class="list">${
      transit
        .sort((a, b) => (a.eta || '9').localeCompare(b.eta || '9'))
        .slice(0, 6)
        .map(
          s =>
            `<li><div class="t"><b>${esc(s.ref)}</b><small>${esc((byId('carriers', s.carrierId) || {}).name || '—')} · وصول ${fmtD(s.eta)}</small></div><div class="r">${s.eta ? pill(dueKind(s.eta), dueText(s.eta)) : ''}</div></li>`
        )
        .join('') || '<li style="color:var(--mute)">لا توجد شحنات بالطريق</li>'
    }</ul></div>
  </div>
  </div>`;
}
function factoriesView() {
  if (!S.factories.length)
    return empty(
      'لا توجد مصانع',
      'أضف المصانع التي تستورد منها لتربطها بالطلبات.',
      `<button class="btn" data-act="new-factory">${ico('plus')} مصنع جديد</button>`
    );
  return `<div class="cards">${S.factories
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    .map(f => {
      const os = S.orders.filter(o => o.factoryId === f.id);
      const rem = {};
      os.forEach(o => addTo(rem, o.currency, oi(o).remaining));
      return `<div class="card" tabindex="0" role="button" data-act="open-factory" data-id="${f.id}"><h3>${esc(f.name)}</h3><div class="mini"><span>${esc(f.city || '')}</span><span dir="ltr">${esc(f.phone || '')}</span></div><div class="mini"><span>طلبات مفتوحة</span><b>${os.filter(o => o.stage !== 'received').length} من ${os.length}</b></div><div class="mini"><span>المتبقي له</span><b>${multi(rem)}</b></div></div>`;
    })
    .join('')}</div>`;
}
function openFactory(id) {
  const draw = () => {
    const f = byId('factories', id);
    if (!f) return '';
    const os = S.orders
      .filter(o => o.factoryId === id)
      .sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''));
    const tot = {},
      pd = {},
      rm = {};
    os.forEach(o => {
      const i = oi(o);
      addTo(tot, o.currency, i.total);
      addTo(pd, o.currency, i.paid);
      addTo(rm, o.currency, i.remaining);
    });
    const rows = os
      .map(o => {
        const i = oi(o);
        return `<li><div class="t"><button class="link" data-act="open-order" data-id="${o.id}"><b>${esc(o.ref)}</b></button><small>${fmtD(o.orderDate)} · ${pill(STAGE_K[o.stage], stageName(o.stage))} ${pill(i.pay[0], i.pay[1])}</small></div><div class="r">${money(i.total, o.currency)}<br><small style="color:var(--mute)">المتبقي ${money(i.remaining, o.currency)}</small></div></li>`;
      })
      .join('');
    return `<div class="mini"><span>${esc([f.city, f.contact].filter(Boolean).join(' · '))}</span><span dir="ltr">${esc(f.phone || '')}</span></div>
    <div class="kv"><div><small>عدد الطلبات</small><b>${os.length}</b></div><div><small>إجمالي الطلبات</small><b>${multi(tot, true)}</b></div><div><small>المدفوع</small><b>${multi(pd, true)}</b></div><div><small>المتبقي له</small><b>${multi(rm, true)}</b></div></div>
    <div><h3 style="margin-bottom:6px">الطلبات</h3><ul class="list">${rows || '<li style="color:var(--mute)">لا توجد طلبات لهذا المصنع بعد</li>'}</ul></div>
    ${f.note ? `<div class="hint">${esc(f.note)}</div>` : ''}
    <div class="mf"><button class="btn ghost" type="button" data-act="edit-factory" data-id="${id}">${ico('edit', 16)} تعديل المصنع</button></div>`;
  };
  const f = byId('factories', id);
  if (!f) return;
  openModal('كشف حساب: ' + f.name, draw(), {
    wide: true,
    refresh: () => {
      const fm = $('#mform');
      if (fm) {
        const h = draw();
        if (h) fm.innerHTML = h;
      }
    }
  });
}
function activityView() {
  if (!actLoaded) return '<div class="skel"></div>';
  if (!ACT.length) return empty('لا يوجد نشاط مسجّل بعد', 'كل إضافة وتعديل وحذف وتسديد يظهر هنا مع اسم صاحبه ووقته.');
  const T = {
    add: ['ok', 'إضافة'],
    edit: ['info', 'تعديل'],
    delete: ['bad', 'حذف'],
    pay: ['ok', 'تسديد'],
    stage: ['warn', 'نقل مرحلة'],
    backup: ['mute', 'نسخة احتياطية'],
    restore: ['warn', 'استعادة'],
    demo: ['mute', 'بيانات تجريبية']
  };
  return `<table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${ACT.map(
    a => {
      const t = T[a.act] || ['mute', a.act || '—'];
      return `<tr><td class="n" data-label="الوقت">${fmtDT(a.at)}</td><td data-label="المستخدم"><span class="who" data-uid="${esc(a.by || '')}">—</span></td><td data-label="العملية">${pill(t[0], t[1])}${a.col && COL_TXT[a.col] ? ' <small style="color:var(--mute)">' + COL_TXT[a.col] + '</small>' : ''}</td><td data-label="التفاصيل">${esc(a.label || '')}</td></tr>`;
    }
  ).join('')}</tbody></table><p class="foot">يُعرض آخر ١٥٠ نشاطاً.</p>`;
}
async function fillNames() {
  const els = [...document.querySelectorAll('[data-uid]')];
  if (!els.length) return;
  let ps = {};
  try {
    if (userNS) ps = await userNS.profiles([...new Set(els.map(e => e.dataset.uid).filter(Boolean))]);
  } catch (e) {}
  els.forEach(e => {
    const u = e.dataset.uid,
      p = ps[u];
    e.textContent = (p && p.name) || (p && p.isMe ? 'أنت' : u ? 'مستخدم' : 'النظام');
  });
}
function uiMode() {
  return document.documentElement.getAttribute('data-ui') === 'light' ? 'light' : 'dark';
}
function setUI(v) {
  if (v === 'light') document.documentElement.setAttribute('data-ui', 'light');
  else document.documentElement.removeAttribute('data-ui');
  try {
    localStorage.setItem('ts_ui', v);
  } catch (e) {}
  render();
}
function backupView() {
  const hasDemo = COLS.some(c => S[c].some(x => x.demo));
  return `<div class="panels">
   
   <div class="card"><h3>تصدير إلى Excel</h3><p style="color:var(--mute);margin:0 0 12px">ملف واحد فيه الطلبات مع صورها، وورقة لكل الصور بحجم كبير، والدفعات والشحنات والمصانع وشركات الشحن. يفتح في Excel و WPS وNumbers بدون إنترنت أو خدمات Google.</p><button class="btn" data-act="export-xlsx">${ico('down')} تنزيل ملف Excel</button></div>
   <div class="card"><h3>نسخة احتياطية</h3><p style="color:var(--mute);margin:0 0 12px">نسخة كاملة بصيغة JSON. احتفظ بنسخة دورية خارج النظام. الاستعادة تدمج النسخة مع الموجود ولا تحذف شيئاً.<br><b style="color:var(--fg)">${META.backup ? 'آخر نسخة: ' + fmtDT(META.backup.at) : 'لم تُحفظ نسخة بعد'}</b></p><div class="bar"><button class="btn ghost" data-act="export-json">${ico('down')} حفظ نسخة</button><label class="btn ghost filebtn adm">${ico('up')} استعادة نسخة<input type="file" id="restoreFile" accept=".json" class="vh"></label></div></div>
   <div class="card"><h3>المظهر</h3><p style="color:var(--mute);margin:0 0 12px">اختار شكل الشاشة. كل جهاز يتذكر اختياره.</p><div class="uisw" role="group" aria-label="المظهر"><button type="button" data-act="ui-theme" data-v="dark" aria-pressed="${uiMode() !== 'light'}"><span class="sw d"></span>غامق</button><button type="button" data-act="ui-theme" data-v="light" aria-pressed="${uiMode() === 'light'}"><span class="sw l"></span>أبيض نظيف</button></div></div>
   <div class="card"><h3>الترجمة التلقائية</h3><p style="color:var(--mute);margin:0 0 12px">النصوص الي يكتبها الموظف بالصيني تطلعلك بالعربي، والي تكتبها إنت تطلعله بالصيني. الأصل يبقى محفوظ مثل ما انكتب.</p><div class="uisw" role="group" aria-label="الترجمة التلقائية"><button type="button" data-act="ct-auto" data-v="1" aria-pressed="${I18N.isAuto()}">تشغيل</button><button type="button" data-act="ct-auto" data-v="0" aria-pressed="${!I18N.isAuto()}">إيقاف (عرض الأصل)</button></div></div>
   ${hasDemo ? `<div class="card"><h3>بيانات تجريبية قديمة</h3><p style="color:var(--mute);margin:0 0 12px">اكو بيانات تجريبية بالنظام. تكدر تحذفها كلها بضغطة بدون ما تمس بياناتك.</p><div class="bar"><button class="btn danger" data-act="demo-clear">حذف التجريبي</button></div></div>` : ''}
  </div>`;
}
