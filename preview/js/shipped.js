/* Shipped orders live on the shipments page.
   - "تحديد كمشحون" (or the stage in the order form) moves an order to الشحنات → بالطريق; it leaves the
     default orders list (it is still found by search and by the orders filter «تم الشحن» / «كل الطلبات»).
   - "✓ وصلت" on its card makes it «مستلم» → الشحنات → وصلت.
   - Dates: shippedAt / receivedAt are saved from now on (added fields only; nothing else in the order changes).
     Older orders: the admin's screen reads the date from the change history; otherwise it shows —.
   Money is untouched: remaining/paid come from logic.js as everywhere else. */

/* extra fields to save when an order's stage changes */
function stageStamp(o, st) {
  const x = {};
  if (st === 'shipped' && o.stage !== 'shipped' && !o.shippedAt) x.shippedAt = todayISO();
  if (st === 'received' && o.stage !== 'received' && !o.receivedAt) x.receivedAt = todayISO();
  return x;
}

/* dates for orders shipped/received before the fields existed (admin can read docs_history) */
const STAGE_HIST = { loaded: false, busy: false, shipped: {}, received: {} };
function loadStageHistory() {
  if (STAGE_HIST.loaded || STAGE_HIST.busy || !ADMIN || typeof SB === 'undefined' || !SB) return;
  STAGE_HIST.busy = true;
  SB.from('docs_history')
    .select('doc_id,old_data,new_data,changed_at')
    .eq('col', 'orders')
    .order('changed_at', { ascending: true })
    .limit(5000)
    .then(({ data }) => {
      (data || []).forEach(h => {
        const a = h.old_data && h.old_data.stage,
          b = h.new_data && h.new_data.stage;
        if (b && a !== b && (b === 'shipped' || b === 'received')) STAGE_HIST[b][h.doc_id] = String(h.changed_at).slice(0, 10);
      });
      STAGE_HIST.loaded = true;
      STAGE_HIST.busy = false;
      if (cur === 'shipments') render();
    })
    .catch(() => {
      STAGE_HIST.loaded = true;
      STAGE_HIST.busy = false;
    });
}
const shippedOn = o => o.shippedAt || STAGE_HIST.shipped[o.id] || '';
const receivedOn = o => o.receivedAt || STAGE_HIST.received[o.id] || '';

const SHP_TAB = { v: 'way' };
function shippedSection() {
  loadStageHistory();
  const way = S.orders.filter(o => o.stage === 'shipped'),
    got = S.orders.filter(o => o.stage === 'received');
  const tab = SHP_TAB.v;
  const list = (tab === 'way' ? way : tab === 'got' ? got : way.concat(got)).slice().sort((a, b) => {
    const da = a.stage === 'shipped' ? shippedOn(a) : receivedOn(a),
      db2 = b.stage === 'shipped' ? shippedOn(b) : receivedOn(b);
    return (a.stage === 'received') - (b.stage === 'received') || (db2 || '').localeCompare(da || '') || byNewest(a, b);
  });
  const seg = `<div class="shp-top"><div class="seg" role="tablist">${[
    ['way', 'بالطريق', way.length],
    ['got', 'وصلت', got.length],
    ['all', 'الكل', '']
  ]
    .map(
      ([k, l, n]) =>
        `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="shp-tab" data-v="${k}">${l}${n !== '' ? ` <b>${n}</b>` : ''}</button>`
    )
    .join('')}</div></div>`;
  const card = o => {
    const f = factoryName(o.factoryId),
      i = oi(o),
      onWay = o.stage === 'shipped',
      d = onWay ? shippedOn(o) : receivedOn(o),
      days = d ? Math.max(0, -diffDays(d)) : null,
      c = +o.cartons || 0;
    const pay = !i.total ? '' : i.remaining > 0.005 ? `<span class="bad">باقي ${money(i.remaining, o.currency)}</span>` : '<span class="ok">مسدد ✓</span>';
    return `<div class="card shp"><div class="shp-h"><i class="av" style="--av:${avColor(f)}">${esc(avLetter(f))}</i><div class="t"><b>${refH(o.ref)}</b><small>${esc(f)}</small></div>${onWay ? pill('info', 'بالطريق') : pill('ok', 'وصلت')}</div>
      <div class="shp-g"><div><small>${onWay ? 'انشحن' : 'وصل'}</small><b>${d ? fmtD(d) : '—'}</b><span>${days == null ? '' : days === 0 ? 'اليوم' : (onWay ? 'صارله ' : 'قبل ') + num(days) + (days === 1 ? ' يوم' : ' يوم')}</span></div>
      <div><small>الكراتين</small><b>${c ? num(c) : '—'}</b><span>${c ? 'كرتون' : ''}</span></div>
      <div><small>قيمة البضاعة</small><b>${i.total ? money(i.total, o.currency) : '—'}</b><span>${pay}</span></div></div>
      <div class="shp-a">${onWay ? `<button class="btn" type="button" data-act="ord-arrived" data-id="${o.id}">${ico('check', 16)} وصلت</button>` : ''}<button class="btn ghost" type="button" data-act="open-order" data-id="${o.id}">افتح الطلب</button></div>
      <button class="link sm shp-undo" type="button" data-act="stage-back" data-id="${o.id}">↩ ${onWay ? 'غلط، مو مشحون (رجّعه جاهز للشحن)' : 'غلط، ما وصل (رجّعه بالطريق)'}</button></div>`;
  };
  const body = list.length
    ? list.map(card).join('')
    : empty(
        tab === 'got' ? 'ما وصل شي بعد' : 'ماكو طلبات بالطريق',
        tab === 'got' ? 'لما تضغط «وصلت» على طلب، ينتقل هنا.' : 'لما تسوي طلب «تحديد كمشحون» يطلع هنا لحاله.'
      );
  return `${seg}<div class="shp-list">${body}</div>`;
}
/* the shipments page: shipped orders first, then the shipments you registered by hand (if any) */
function shipmentsPage(toolbarHtml) {
  return shippedSection() + (S.shipments.length ? `<h3 class="shp-sec">الشحنات المسجلة</h3>${toolbarHtml}` : '');
}
async function orderArrived(id) {
  const o = byId('orders', id);
  if (!o || o.stage !== 'shipped') return;
  try {
    await put('orders', Object.assign({}, o, { stage: 'received' }, stageStamp(o, 'received')));
    toast('تم: الطلب ' + o.ref + ' وصل');
  } catch (e) {}
}

/* undo a wrong click: shipped → ready (removes the ship date), received → shipped (removes the arrival date) */
const STAGE_BACK = { shipped: 'ready', received: 'shipped' };
async function orderStageBack(id) {
  const o = byId('orders', id);
  if (!o || !STAGE_BACK[o.stage]) return;
  const back = STAGE_BACK[o.stage],
    n = Object.assign({}, o, { stage: back });
  if (o.stage === 'shipped') delete n.shippedAt;
  if (o.stage === 'received') delete n.receivedAt;
  try {
    await put('orders', n);
    toast('رجع الطلب ' + o.ref + ' إلى: ' + stageName(back));
  } catch (e) {}
}
