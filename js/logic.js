/* Business rules: order totals, payment status, alerts */
const STAGES = [
  ['production', 'قيد التصنيع'],
  ['ready', 'جاهز للشحن'],
  ['shipped', 'تم الشحن'],
  ['received', 'مستلم']
];
const STAGE_K = { production: 'info', ready: 'warn', shipped: 'info', received: 'ok' };
const stageName = s => (STAGES.find(x => x[0] === s) || [0, '—'])[1];
const SHIP_ST = [
  ['preparing', 'قيد التجهيز'],
  ['transit', 'بالطريق'],
  ['arrived', 'وصلت']
];
const SHIP_K = { preparing: 'warn', transit: 'info', arrived: 'ok' };
const shipName = s => (SHIP_ST.find(x => x[0] === s) || [0, '—'])[1];
const r2 = n => Math.round(((+n || 0) + Number.EPSILON) * 100) / 100;
const itemsTotal = o => {
  const it = o.items || [];
  return it.length ? r2(it.reduce((a, i) => a + r2((+i.qty || 0) * (+i.price || 0)), 0)) : r2(+o.total || 0);
};
const ORD = [
  'الأولى',
  'الثانية',
  'الثالثة',
  'الرابعة',
  'الخامسة',
  'السادسة',
  'السابعة',
  'الثامنة',
  'التاسعة',
  'العاشرة'
];
const ordName = n => 'الدفعة ' + (ORD[n - 1] || 'رقم ' + n);
const payKey = p => p.dueDate || p.paidDate || '9999-12-31';
function orderedPays(orderId, excludeId) {
  return S.payments
    .filter(p => p.orderId === orderId && p.id !== excludeId)
    .sort((a, b) => payKey(a).localeCompare(payKey(b)) || (a.createdAt || 0) - (b.createdAt || 0));
}
/* ordered payment plan of an order: each payment with its number, running total and what is left after it */
function payPlan(o, excludeId) {
  const total = itemsTotal(o);
  let cum = 0;
  return orderedPays(o.id, excludeId).map((p, i) => {
    cum = r2(cum + (+p.amount || 0));
    return { p, n: i + 1, cum, after: r2(total - cum) };
  });
}
function oi(o) {
  const total = itemsTotal(o);
  const pays = S.payments.filter(p => p.orderId === o.id);
  const paid = r2(pays.filter(p => p.paid).reduce((a, p) => a + (+p.amount || 0), 0));
  const scheduled = r2(pays.filter(p => !p.paid).reduce((a, p) => a + (+p.amount || 0), 0));
  const remaining = r2(Math.max(total - paid, 0));
  const unscheduled = r2(Math.max(total - paid - scheduled, 0));
  const unpaid = pays.filter(p => !p.paid);
  const lateP = unpaid.some(p => p.dueDate && diffDays(p.dueDate) < 0);
  let pay;
  if (!total) pay = ['mute', 'بدون مبلغ'];
  else if (remaining <= 0.001) pay = ['ok', 'مدفوع'];
  else if (lateP) pay = ['bad', 'متأخرة'];
  else if (paid > 0) pay = ['warn', 'جزئي'];
  else pay = ['info', 'مستحق'];
  const done = ['ready', 'shipped', 'received'].includes(o.stage);
  let timing = null;
  if (!done && o.prepDate) {
    const d = diffDays(o.prepDate);
    timing =
      d < 0
        ? { k: 'bad', t: 'متأخر ' + plural(-d) }
        : d <= 7
          ? { k: 'warn', t: d === 0 ? 'اليوم' : 'بعد ' + plural(d) }
          : { k: 'ok', t: 'في الموعد' };
  }
  let recv = null;
  if (o.stage !== 'received' && o.recvDate) {
    const d = diffDays(o.recvDate);
    recv =
      d < 0
        ? { k: 'bad', t: 'متأخر ' + plural(-d) }
        : d <= 7
          ? { k: 'warn', t: d === 0 ? 'اليوم' : 'بعد ' + plural(d) }
          : { k: 'ok', t: 'بعد ' + plural(d) };
  }
  return { total, paid, scheduled, unscheduled, remaining, pay, timing, recv, pays };
}
function dateLines(o, i) {
  const ln = (l, d, t) =>
    d
      ? `<div class="dline"><small>${l}</small>${t && t.k !== 'ok' ? pill(t.k, t.t) : ''}<small>${fmtD(d)}</small></div>`
      : '';
  return (
    ln('تجهيز', o.prepDate, i.timing) + ln('استلام', o.recvDate, i.recv) || '<span style="color:var(--mute)">—</span>'
  );
}
const factoryName = id => {
  const f = byId('factories', id);
  return f ? f.name : '—';
};
const orderLabel = o => (o ? (o.ref || 'بدون رقم') + ' · ' + factoryName(o.factoryId) : '—');
const carrOpen = (c, o) => {
  if (c && +c.openBal) addTo(o, c.openCur || 'USD', +c.openBal);
  return o;
};
const balTxt = o => {
  const k = Object.keys(o).filter(c => Math.abs(o[c]) > 0.001);
  if (!k.length) return money(0, 'CNY');
  return k.map(c => (o[c] < 0 ? 'لك ' + money(-o[c], c) : money(o[c], c))).join(' · ');
};
const shipRemaining = s => r2(Math.max((+s.cost || 0) - (+s.paidAmount || 0), 0));
const norm = s =>
  String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const ferr = (msg, field) => {
  const e = $('#ferr');
  if (e) {
    e.textContent = msg;
    e.hidden = false;
  }
  const f = $('#mform');
  if (field && f && f.elements[field] && f.elements[field].focus) f.elements[field].focus();
  else if (e && e.scrollIntoView) e.scrollIntoView({ block: 'nearest' });
};
