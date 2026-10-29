/* Modal + all forms (orders, payments, shipments, factories, carriers) */
const M = { el: null, refresh: null, back: null };
let lastFocus = null;
function closeModal(skipBack) {
  if (M.el) {
    M.el.remove();
    M.el = null;
    if (!skipBack && lastFocus && lastFocus.isConnected && lastFocus.focus)
      try {
        lastFocus.focus();
      } catch (e) {}
  }
  M.refresh = null;
  const b = M.back;
  M.back = null;
  if (!skipBack && b) b();
}
function openModal(title, body, o) {
  o = o || {};
  if (!M.el) lastFocus = document.activeElement;
  closeModal(true);
  const el = document.createElement('div');
  el.className = 'ovl';
  const del = o.del
    ? `<button type="button" class="btn ghost" data-act="del-ask" data-col="${o.del[0]}" data-id="${o.del[1]}" style="margin-inline-end:auto">${ico('trash', 16)} حذف</button>`
    : '';
  el.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><h2>${esc(title)}</h2><button class="icon" type="button" data-act="close" aria-label="إغلاق">${ico('x')}</button></div><form class="mb" id="mform" novalidate>${body}${o.onSubmit ? `<div class="hint bad" id="ferr" role="alert" hidden></div><div class="mf">${del}<button type="button" class="btn ghost" data-act="close">إلغاء</button><button class="btn" type="submit" id="msave">${o.submitText || 'حفظ'}</button></div>` : ''}</form></div>`;
  el.addEventListener('mousedown', e => {
    if (e.target === el) closeModal();
  });
  $('#layer').appendChild(el);
  M.el = el;
  M.back = o.back || null;
  M.refresh = o.refresh || null;
  const f = $('#mform');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!o.onSubmit || f.dataset.busy) return;
    f.dataset.busy = '1';
    const er = $('#ferr');
    if (er) er.hidden = true;
    const b = $('#msave');
    if (b) b.disabled = true;
    try {
      await o.onSubmit(f);
    } catch (x) {
    } finally {
      delete f.dataset.busy;
      if (b) b.disabled = false;
    }
  });
  if (o.onOpen) o.onOpen(f);
  const first = f.querySelector('input:not([type=hidden]),select,textarea');
  if (first && o.onSubmit && !('ontouchstart' in window)) first.focus();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const lbx = $('#lb');
    if (lbx && !lbx.hidden) {
      closeLb();
      return;
    }
    const mr = $('#more');
    if (mr && !mr.hidden) {
      mr.hidden = true;
      return;
    }
    if (M.el) closeModal();
  }
});

const fld = (label, html, cls) => `<label class="fld ${cls || ''}"><span>${label}</span>${html}</label>`;
const inp = (name, val, type, extra) =>
  `<input id="f_${name}" name="${name}" type="${type || 'text'}" value="${esc(val == null ? '' : val)}" ${type === 'number' ? 'step="any" inputmode="decimal" min="0"' : ''} ${extra || ''}>`;
const sel = (name, opts, val) =>
  `<select id="f_${name}" name="${name}">${opts.map(o => `<option value="${esc(o[0])}"${o[0] === val ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
const ta = (name, val) => `<textarea id="f_${name}" name="${name}" rows="2">${esc(val || '')}</textarea>`;
const val = (f, n) => (f.elements[n] ? f.elements[n].value : '').trim();

/* ---------- forms ---------- */
function factoryForm(f0, back) {
  const e = f0 || {};
  openModal(
    f0 ? 'تعديل مصنع' : 'مصنع جديد',
    `<div class="grid2">${fld('اسم المصنع', inp('name', e.name, 'text', 'required'))}${fld('المدينة / المنطقة', inp('city', e.city))}${fld('مسؤول التواصل', inp('contact', e.contact))}${fld('هاتف / WeChat', inp('phone', e.phone, 'text', 'dir="ltr"'))}</div>${fld('ملاحظات', ta('note', e.note))}`,
    {
      back,
      del: f0 ? ['factories', f0.id] : null,
      onSubmit: async f => {
        const name = val(f, 'name');
        if (!name) {
          ferr('اكتب اسم المصنع', 'name');
          return;
        }
        if (S.factories.some(x => x.id !== e.id && norm(x.name) === norm(name))) {
          ferr('يوجد مصنع بنفس الاسم. اختر اسماً مميزاً أو عدّل المصنع الموجود.', 'name');
          return;
        }
        await put(
          'factories',
          Object.assign({}, e, {
            id: e.id || newId('factories'),
            name,
            city: val(f, 'city'),
            contact: val(f, 'contact'),
            phone: val(f, 'phone'),
            note: val(f, 'note')
          })
        );
        closeModal();
        toast('تم الحفظ');
      }
    }
  );
}
function carrierForm(c0, back) {
  const e = c0 || {};
  openModal(
    c0 ? 'تعديل شركة شحن' : 'شركة شحن جديدة',
    `<div class="grid2">${fld('اسم الشركة', inp('name', e.name, 'text', 'required'))}${fld(
      'نوع الشحن',
      sel(
        'mode',
        [
          ['sea', 'بحري'],
          ['air', 'جوي'],
          ['land', 'بري'],
          ['mixed', 'متعدد']
        ],
        e.mode || 'sea'
      )
    )}${fld('مسؤول التواصل', inp('contact', e.contact))}${fld('هاتف', inp('phone', e.phone, 'text', 'dir="ltr"'))}${fld(
      'رصيد سابق مع الشركة (¥)',
      inp('openBal', e.openBal ? Math.abs(e.openBal) : '', 'number') +
        sel(
          'openDir',
          [
            ['owe', 'عليّ (هي تطلبني)'],
            ['due', 'لي (أنا أطلبها)']
          ],
          +e.openBal < 0 ? 'due' : 'owe'
        ),
      'signed'
    )}${
      +e.openBal && (e.openCur || 'USD') === 'USD'
        ? fld(
            'عملة الرصيد السابق',
            sel(
              'openCur',
              [
                ['USD', 'دولار $'],
                ['CNY', 'يوان ¥']
              ],
              'USD'
            )
          )
        : inp('openCur', 'CNY', 'hidden')
    }</div>${fld('ملاحظات', ta('note', e.note))}`,
    {
      back,
      del: c0 ? ['carriers', c0.id] : null,
      onSubmit: async f => {
        const name = val(f, 'name');
        if (!name) {
          ferr('اكتب اسم الشركة', 'name');
          return;
        }
        if (S.carriers.some(x => x.id !== e.id && norm(x.name) === norm(name))) {
          ferr('توجد شركة شحن بنفس الاسم.', 'name');
          return;
        }
        await put(
          'carriers',
          Object.assign({}, e, {
            id: e.id || newId('carriers'),
            name,
            mode: val(f, 'mode'),
            contact: val(f, 'contact'),
            phone: val(f, 'phone'),
            openBal: (() => {
              const v = Math.abs(parseFloat(val(f, 'openBal')) || 0);
              return val(f, 'openDir') === 'due' ? -v : v;
            })(),
            openCur: val(f, 'openCur'),
            note: val(f, 'note')
          })
        );
        closeModal();
        toast('تم الحفظ');
      }
    }
  );
}
function itemRow(it) {
  it = it || {};
  return `<div class="irow"><input class="iname" placeholder="اسم المنتج" value="${esc(it.name || '')}" aria-label="اسم المنتج"><input class="iqty" type="number" step="any" min="0" inputmode="decimal" placeholder="الكمية" value="${esc(it.qty == null ? '' : it.qty)}" aria-label="الكمية"><input class="iprice" type="number" step="any" min="0" inputmode="decimal" placeholder="سعر الوحدة" value="${esc(it.price == null ? '' : it.price)}" aria-label="سعر الوحدة"><button type="button" class="icon" data-act="rm-item" aria-label="حذف البند">${ico('x', 16)}</button></div>`;
}
function readItems() {
  return [...document.querySelectorAll('#items .irow')]
    .map(r => ({
      name: r.querySelector('.iname').value.trim(),
      qty: parseFloat(r.querySelector('.iqty').value) || 0,
      price: parseFloat(r.querySelector('.iprice').value) || 0
    }))
    .filter(i => i.name || i.qty || i.price);
}
function updItemsTotal() {
  const cur = document.getElementById('f_currency');
  if (!cur) return;
  const t = readItems().reduce((a, i) => a + i.qty * i.price, 0);
  $('#itot').innerHTML = money(t, cur.value);
}
function importItemsFile(file) {
  if (!window.XLSX) {
    toast('مكتبة Excel غير محمّلة', 'bad');
    return;
  }
  const r = new FileReader();
  r.onload = () => {
    try {
      const wb = XLSX.read(r.result, { type: 'array' });
      const rows = XLSX.utils
        .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
        .filter(x => x.some(c => String(c).trim() !== ''));
      if (!rows.length) {
        toast('الملف فارغ', 'bad');
        return;
      }
      const head = rows[0].map(c => String(c).toLowerCase());
      const find = (re, fb) => {
        const i = head.findIndex(h => re.test(h));
        return i >= 0 ? i : fb;
      };
      const iN = find(/اسم|منتج|صنف|بيان|name|product|item|desc/, 0),
        iQ = find(/كمي|عدد|qty|quant|pcs/, 1),
        iP = find(/سعر|price|unit/, 2);
      const hasHead = head.some(h => /اسم|منتج|صنف|بيان|كمي|عدد|سعر|name|product|item|qty|price/.test(h));
      const data = (hasHead ? rows.slice(1) : rows)
        .map(x => ({ name: String(x[iN] || '').trim(), qty: parseFloat(x[iQ]) || 0, price: parseFloat(x[iP]) || 0 }))
        .filter(i => i.name);
      if (!data.length) {
        toast('لم أجد بنوداً في الملف', 'bad');
        return;
      }
      const box = $('#items');
      const only = box.querySelectorAll('.irow');
      if (only.length === 1 && !readItems().length) box.innerHTML = '';
      data.forEach(i => box.insertAdjacentHTML('beforeend', itemRow(i)));
      updItemsTotal();
      toast('تم استيراد ' + data.length + ' بند');
    } catch (e) {
      toast('تعذر قراءة الملف', 'bad');
    }
  };
  r.readAsArrayBuffer(file);
}
function orderForm(o0, back) {
  if (!S.factories.length && !CANEDIT) {
    toast('ماكو مصانع بعد. المدير يضيفها', 'bad');
    return;
  }
  let lastF = '',
    lastC = '';
  try {
    lastF = localStorage.getItem('ts_lastFactory') || '';
    lastC = localStorage.getItem('ts_lastCur') || '';
  } catch (x) {}
  const e = o0 || {
    stage: 'production',
    currency: 'CNY',
    orderDate: todayISO(),
    items: [],
    factoryId: byId('factories', lastF) ? lastF : S.factories[0] ? S.factories[0].id : ''
  };
  const noF = !S.factories.length;
  const body = `<div class="grid2 og">
    <div class="fld wide"><span>المصنع</span><div class="frow">${
      noF
        ? ''
        : sel(
            'factoryId',
            S.factories
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
              .map(f => [f.id, f.name]),
            e.factoryId
          )
    }${CANEDIT ? `<button type="button" class="btn ghost sm" data-act="nf-toggle"${noF ? ' hidden' : ''}>${ico('plus', 14)} مصنع جديد</button>` : ''}</div>
      <div class="nfbox" id="nfBox"${noF ? '' : ' hidden'}>${inp('newFactory', '', 'text', 'placeholder="اكتب اسم المصنع الجديد" autocomplete="off"')}<small>ينضاف للمصانع تلقائياً وينربط بهذا الطلب.</small></div></div>
    ${fld('رقم الطلب / الفاتورة', inp('ref', e.ref, 'text', 'required autocomplete="off"'), 'wide')}
    ${fld('إجمالي الطلب', inp('total', o0 ? itemsTotal(e) || '' : '', 'number', 'placeholder="0"'))}
    ${
      e.currency === 'USD'
        ? fld(
            'العملة',
            sel(
              'currency',
              [
                ['CNY', 'يوان ¥ (رمبي)'],
                ['USD', 'دولار $']
              ],
              e.currency
            )
          )
        : inp('currency', 'CNY', 'hidden')
    }
    ${fld('تاريخ الطلب', inp('orderDate', e.orderDate, 'date'), 'wide')}
  </div>
  ${durField('prepDate', 'المصنع يجهّز الطلب خلال', e.prepDate)}
  <div class="items-h"><h3>صور وملفات الطلب</h3><div class="bar"><label class="btn ghost sm filebtn">${ico('up', 15)} صورة أو ملف<input type="file" id="attachFile" accept="image/*,.xlsx,.xls,.csv,.pdf" multiple class="vh"></label></div></div>
  <ul class="list" id="attList"></ul>
  <details class="more"${o0 && (o0.note || o0.stage !== 'production') ? ' open' : ''}><summary>المرحلة والملاحظات</summary><div class="grid2">${fld('المرحلة', sel('stage', STAGES, e.stage))}</div>${fld('ملاحظات', ta('note', e.note))}</details>`;
  openModal(o0 ? 'تعديل طلب' : 'طلب جديد', body, {
    wide: true,
    back,
    del: o0 ? ['orders', o0.id] : null,
    onOpen: f => {
      PEND = [];
      ATT_E = (o0 && o0.files) || [];
      renderAtt();
      initDur(f);
      $('#attachFile').addEventListener('change', ev => {
        const fl = [...ev.target.files];
        ev.target.value = '';
        queueAttach(fl);
      });
    },
    onSubmit: async f => {
      const ref = val(f, 'ref');
      if (!ref) {
        ferr('اكتب رقم الطلب أو الفاتورة', 'ref');
        return;
      }
      const nfOpen = !$('#nfBox').hidden,
        nfName = nfOpen ? val(f, 'newFactory').trim() : '';
      if (nfOpen && !nfName) {
        ferr('اكتب اسم المصنع الجديد', 'newFactory');
        return;
      }
      let factoryId = nfName ? '' : val(f, 'factoryId');
      if (nfName) {
        const ex = S.factories.find(x => norm(x.name) === norm(nfName));
        factoryId = ex ? ex.id : '__new';
      }
      if (!factoryId || (factoryId !== '__new' && !byId('factories', factoryId))) {
        ferr(nfOpen ? 'اكتب اسم المصنع' : 'اختر المصنع', nfOpen ? 'newFactory' : 'factoryId');
        return;
      }
      if (S.orders.some(x => x.id !== e.id && x.factoryId === factoryId && norm(x.ref) === norm(ref))) {
        ferr('يوجد طلب بنفس الرقم لهذا المصنع. تأكد من الرقم أو افتح الطلب الموجود.', 'ref');
        return;
      }
      const od = val(f, 'orderDate'),
        pd = val(f, 'prepDate'),
        rd = e.recvDate || '';
      if (!od) {
        ferr('اختر تاريخ الطلب', 'orderDate');
        return;
      }
      if (pd && pd < od) {
        ferr('موعد التجهيز لا يمكن أن يسبق تاريخ الطلب', 'prepDate');
        return;
      }
      const tv = val(f, 'total'),
        total = r2(parseFloat(tv) || 0);
      if (tv !== '' && !(parseFloat(tv) >= 0)) {
        ferr('إجمالي الطلب غير صالح', 'total');
        return;
      }
      const oldItems = e.items || [],
        items = oldItems.length && Math.abs(itemsTotal({ items: oldItems }) - total) < 0.005 ? oldItems : [];
      if (o0) {
        const newTotal = total,
          recorded = r2(S.payments.filter(p => p.orderId === o0.id).reduce((a, p) => a + (+p.amount || 0), 0));
        if (recorded > newTotal + 0.005 && recorded > 0) {
          ferr(
            'الدفعات المسجّلة لهذا الطلب (' +
              num(recorded) +
              ') أكبر من الإجمالي الجديد (' +
              num(newTotal) +
              '). عدّل الدفعات أولاً أو راجع المبلغ.'
          );
          return;
        }
      }
      if (factoryId === '__new') {
        factoryId = newId('factories');
        try {
          await put(
            'factories',
            { id: factoryId, createdAt: Date.now(), name: nfName, city: '', contact: '', phone: '', note: '' },
            { quiet: true }
          );
        } catch (err) {
          ferr('تعذر إضافة المصنع');
          return;
        }
      }
      const oid = e.id || newId('orders'),
        metas = (e.files || []).slice();
      if (PEND.length) toast('جارٍ حفظ المرفقات…');
      for (const a of PEND) {
        try {
          metas.push(await storeFile(oid, a));
        } catch (err) {
          toast('تعذر حفظ المرفق «' + a.name + '»', 'bad');
          return;
        }
      }
      const currency = val(f, 'currency');
      await put(
        'orders',
        Object.assign({}, e, {
          id: oid,
          files: metas,
          createdAt: e.createdAt || Date.now(),
          factoryId,
          ref,
          orderDate: od,
          prepDate: pd,
          recvDate: rd,
          stage: val(f, 'stage'),
          currency,
          items,
          total,
          note: val(f, 'note')
        })
      );
      try {
        localStorage.setItem('ts_lastFactory', factoryId);
        localStorage.setItem('ts_lastCur', currency);
      } catch (x) {}
      PEND = [];
      closeModal();
      toast('تم حفظ الطلب');
    }
  });
}
const DUR = [
  [15, '15 يوم'],
  [30, 'شهر'],
  [45, '45 يوم'],
  [60, 'شهرين'],
  [90, '3 أشهر']
];
function durField(name, label, v) {
  return `<div class="fld durf"><span>${label}</span><div class="chips">${DUR.map(d => `<button type="button" class="chip" data-act="dur" data-t="${name}" data-d="${d[0]}">${d[1]}</button>`).join('')}</div>
  <div class="durrow"><label class="durn"><input type="number" inputmode="numeric" min="0" step="1" class="durdays" data-t="${name}" placeholder="أيام" aria-label="عدد الأيام"><small>يوم</small></label><input id="f_${name}" name="${name}" type="date" value="${esc(v || '')}" aria-label="${label}"></div>
  <small class="durhint" id="h_${name}"></small></div>`;
}
const baseDate = () => {
  const f = $('#mform');
  return (
    (f && f.elements.orderDate && f.elements.orderDate.value) ||
    (f && f.elements.departDate && f.elements.departDate.value) ||
    todayISO()
  );
};
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
function markDur(f, name, days) {
  f.querySelectorAll(`[data-act=dur][data-t="${name}"]`).forEach(b => b.classList.toggle('on', +b.dataset.d === days));
}
function setDur(name, days, fromInput) {
  const f = $('#mform');
  if (!f || !f.elements[name] || !(days > 0)) return;
  const el = f.elements[name];
  el.value = addDays(baseDate(), days);
  el.dataset.days = days;
  if (!fromInput) {
    const n = f.querySelector(`.durdays[data-t="${name}"]`);
    if (n) n.value = days;
  }
  markDur(f, name, days);
  durHint(name);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function durHint(name) {
  const f = $('#mform'),
    h = $('#h_' + name);
  if (!f || !h || !f.elements[name]) return;
  const v = f.elements[name].value;
  if (!v) {
    h.textContent = '';
    return;
  }
  const d = diffDays(v);
  h.textContent =
    'يوافق ' + fmtD(v) + ' · ' + (d > 0 ? 'بعد ' + plural(d) + ' من اليوم' : d === 0 ? 'اليوم' : 'مضى ' + plural(-d));
}
function initDur(f, names) {
  names = names || ['prepDate', 'recvDate'];
  const baseEl = f.elements.orderDate || f.elements.departDate;
  names.forEach(n => {
    const el = f.elements[n];
    if (!el) return;
    const box = f.querySelector(`.durdays[data-t="${n}"]`);
    const sync = () => {
      const k = el.value ? daysBetween(baseDate(), el.value) : 0;
      if (box) box.value = k > 0 ? k : '';
      if (k > 0) el.dataset.days = k;
      else delete el.dataset.days;
      markDur(f, n, k);
      durHint(n);
    };
    sync();
    el.addEventListener('input', sync);
    if (box)
      box.addEventListener('input', () => {
        const v = parseInt(box.value, 10);
        if (v > 0) setDur(n, v, true);
        else markDur(f, n, 0);
      });
  });
  if (baseEl)
    baseEl.addEventListener('change', () =>
      names.forEach(n => {
        const el = f.elements[n];
        if (el && el.dataset.days) setDur(n, +el.dataset.days);
      })
    );
}
function planHTML(o, excludeId, editing) {
  const plan = payPlan(o, excludeId),
    total = itemsTotal(o);
  const recorded = plan.length ? plan[plan.length - 1].cum : 0;
  const sug = r2(total - recorded);
  const rows = plan
    .map(
      x =>
        `<div><span>${ordName(x.n)}${x.p.label ? ' · <small>' + esc(x.p.label) + '</small>' : ''} ${x.p.paid ? pill('ok', 'مدفوعة ' + fmtD(x.p.paidDate)) : pill(dueKind(x.p.dueDate), 'مجدولة ' + fmtD(x.p.dueDate))}</span><b>${money(x.p.amount, o.currency)}</b></div>`
    )
    .join('');
  const sugLabel = editing ? 'الباقي المقترح لهذه الدفعة' : 'الباقي المقترح للدفعة ' + (ORD[plan.length] || 'التالية');
  const html =
    `<div><span>إجمالي الطلب</span><b>${money(total, o.currency)}</b></div>` +
    (rows || '<div><small>لا توجد دفعات سابقة لهذا الطلب. هذه ستكون الدفعة الأولى.</small></div>') +
    (plan.length
      ? `<div class="sum"><span>مجموع الدفعات المسجّلة</span><b>${money(recorded, o.currency)}</b></div>`
      : '') +
    (total
      ? `<div class="sug ${sug <= 0.005 ? 'zero' : ''}"><span>${sug > 0.005 ? sugLabel : 'الطلب مغطّى بالكامل بالدفعات المسجّلة'}</span><span>${sug > 0.005 ? money(sug, o.currency) + ' <button type="button" class="btn sm" data-act="use-suggest">استخدم</button>' : ''}</span></div>`
      : '<div><small>اكتب إجمالي الطلب أولاً حتى يُحسب الباقي.</small></div>');
  return { sug, html };
}
function paymentForm(p0, orderId, back) {
  if (!S.orders.length) {
    toast('أضف طلباً أولاً', 'bad');
    closeModal(true);
    go('orders');
    return;
  }
  const e = p0 || { orderId: orderId || S.orders[0].id, paid: false, method: 'تحويل بنكي' };
  const body = `${fld(
    'الطلب',
    sel(
      'orderId',
      S.orders.map(o => [o.id, orderLabel(o)]),
      e.orderId
    )
  )}
  <div class="plan" id="plan"></div>
  <div class="chips"><small style="color:var(--mute)">مبلغ سريع:</small>${[30, 40, 50].map(x => `<button type="button" class="chip" data-act="pct" data-pct="${x}">${x}% من الإجمالي</button>`).join('')}<button type="button" class="chip" data-act="use-suggest">الباقي كله</button></div>
  <div class="grid2">
    ${fld('المبلغ', inp('amount', e.amount, 'number', 'required'))}
    ${fld('وصف الدفعة (اختياري)', inp('label', e.label || '', 'text', 'list="plabels" autocomplete="off" placeholder="عربون، قبل الشحن، الرصيد…"') + '<datalist id="plabels"><option value="عربون"><option value="دفعة قبل الشحن"><option value="الرصيد النهائي"></datalist>')}
    ${fld(
      'تاريخ الاستحقاق',
      inp('dueDate', e.dueDate || '', 'date') +
        '<div class="chips qd">' +
        [
          [0, 'اليوم'],
          [7, 'أسبوع'],
          [15, '15 يوم'],
          [30, 'شهر']
        ]
          .map(x => `<button type="button" class="chip" data-act="due" data-d="${x[0]}">${x[1]}</button>`)
          .join('') +
        '</div>'
    )}
    ${fld('دُفعت عن طريق', sel('via', [['', 'مباشرة / غير محدد']].concat(S.carriers.map(c => [c.id, c.name])), e.via || ''))}
    ${fld(
      'طريقة الدفع',
      sel(
        'method',
        [
          ['تحويل بنكي', 'تحويل بنكي'],
          ['نقد', 'نقد'],
          ['حوالة', 'حوالة'],
          ['عن طريق شركة الشحن', 'عن طريق شركة الشحن'],
          ['أخرى', 'أخرى']
        ],
        e.method
      )
    )}
    <label class="fld chk"><input type="checkbox" id="f_paid" name="paid" ${e.paid ? 'checked' : ''}><span>تم تسديد الدفعة</span></label>
    ${fld('تاريخ التسديد', inp('paidDate', e.paidDate || '', 'date'))}
  </div><div class="hint" id="phint"></div>${fld('ملاحظات', ta('note', e.note))}`;
  openModal(p0 ? 'تعديل دفعة' : 'دفعة جديدة', body, {
    back,
    del: p0 ? ['payments', p0.id] : null,
    onOpen: f => {
      let touched = !!p0;
      const hint = () => {
        const o = byId('orders', f.elements.orderId.value);
        const h = $('#phint');
        if (!o || !h) return;
        const plan = payPlan(o, e.id),
          recorded = plan.length ? plan[plan.length - 1].cum : 0,
          total = itemsTotal(o);
        const mine = r2(parseFloat(f.elements.amount.value) || 0),
          left = r2(total - recorded - mine);
        h.className = 'hint' + (total && left < -0.005 ? ' bad' : '');
        const key =
          f.elements.dueDate.value ||
          (f.elements.paid.checked ? f.elements.paidDate.value || todayISO() : '9999-12-31');
        const pos = plan.filter(x => payKey(x.p) <= key).length + 1;
        h.innerHTML = !total
          ? 'لم يُكتب إجمالي الطلب، لذلك لا يمكن التحقق من المبلغ.'
          : left < -0.005
            ? 'المبلغ يتجاوز الباقي بـ ' + money(-left, o.currency)
            : 'هذه ستكون ' +
              ordName(pos) +
              ' بحسب التاريخ. ' +
              (left <= 0.005
                ? 'بها يُغطّى الطلب بالكامل.'
                : 'بعدها يتبقى ' + money(left, o.currency) + ' بدون دفعة مجدولة.');
      };
      const sync = () => {
        const o = byId('orders', f.elements.orderId.value);
        if (!o) return;
        const pl = planHTML(o, e.id, !!p0);
        $('#plan').innerHTML = pl.html;
        f.dataset.sug = pl.sug > 0.005 ? pl.sug : '';
        if (!touched && pl.sug > 0.005) f.elements.amount.value = pl.sug;
        hint();
      };
      f.addEventListener('input', ev => {
        if (ev.target.name === 'amount') touched = true;
        hint();
      });
      f.elements.orderId.addEventListener('change', sync);
      f.elements.paid.addEventListener('change', () => {
        if (f.elements.paid.checked && !f.elements.paidDate.value) f.elements.paidDate.value = todayISO();
      });
      sync();
    },
    onSubmit: async f => {
      const o = byId('orders', val(f, 'orderId'));
      if (!o) {
        ferr('اختر الطلب', 'orderId');
        return;
      }
      const amount = r2(parseFloat(f.elements.amount.value));
      if (!(amount > 0)) {
        ferr('اكتب مبلغاً أكبر من صفر', 'amount');
        return;
      }
      const paid = f.elements.paid.checked,
        due = val(f, 'dueDate'),
        pdt = val(f, 'paidDate');
      if (!paid && !due) {
        ferr('حدد تاريخ استحقاق الدفعة', 'dueDate');
        return;
      }
      if (paid && (pdt || todayISO()) > todayISO()) {
        ferr('تاريخ التسديد لا يمكن أن يكون في المستقبل', 'paidDate');
        return;
      }
      const total = itemsTotal(o),
        plan = payPlan(o, e.id),
        recorded = plan.length ? plan[plan.length - 1].cum : 0;
      if (total > 0 && r2(recorded + amount) > total + 0.005) {
        ferr(
          'المبلغ يتجاوز الباقي من الطلب. أقصى مبلغ ممكن ' + num(r2(total - recorded)) + ' ' + (CUR[o.currency] || ''),
          'amount'
        );
        return;
      }
      await put(
        'payments',
        Object.assign({}, e, {
          id: e.id || newId('payments'),
          createdAt: e.createdAt || Date.now(),
          orderId: o.id,
          label: val(f, 'label'),
          amount,
          dueDate: due,
          paid,
          paidDate: paid ? pdt || todayISO() : '',
          method: val(f, 'method'),
          via: val(f, 'via'),
          note: val(f, 'note')
        })
      );
      closeModal();
      toast('تم حفظ الدفعة');
    }
  });
}
function shipmentForm(s0, orderId, back) {
  if (!S.carriers.length) {
    ensureCarrier().then(ok => {
      if (ok) shipmentForm(s0, orderId, back);
    });
    return;
  }
  const e = s0 || { orderId: orderId || '', status: 'preparing', currency: 'CNY' };
  WS = {
    kind: 'ship',
    car:
      e.carrierId && byId('carriers', e.carrierId)
        ? e.carrierId
        : WCAR && byId('carriers', WCAR)
          ? WCAR
          : S.carriers[0].id,
    ord: e.orderId || null,
    cur: e.currency || 'CNY',
    st: e.status || 'preparing'
  };
  const seg = (k, opts, v, act) =>
    `<div class="chips" role="group">${opts.map(o => `<button type="button" class="chip" data-act="${act || 'w-seg'}" data-k="${k}" data-v="${o[0]}" aria-pressed="${o[0] === v}">${o[1]}</button>`).join('')}</div>`;
  const body = `${wCarPick()}
    <div class="fld"><span>الطلب</span>${comboHTML('cbOrd', true)}</div>
    ${
      WS.cur === 'USD'
        ? `<div class="grid2">${fld('أجور الشحن', inp('cost', e.cost || '', 'number', 'inputmode="decimal"'))}<div class="fld"><span>العملة</span>${seg(
            'cur',
            [
              ['CNY', 'يوان ¥'],
              ['USD', 'دولار $']
            ],
            WS.cur
          )}</div></div>`
        : fld('أجور الشحن (¥)', inp('cost', e.cost || '', 'number', 'inputmode="decimal"'))
    }
    <div class="fld"><span>الحالة</span>${seg('st', SHIP_ST, WS.st, 'sh-st')}</div>
    ${fld('تاريخ المغادرة', inp('departDate', e.departDate || todayISO(), 'date'))}
    ${durField('eta', 'يوصل بعد', e.eta)}
    <details class="more"${e.ref || e.note ? ' open' : ''}><summary>رقم البوليصة وملاحظات (اختياري)</summary>${fld('رقم الشحنة / البوليصة', inp('ref', e.ref || '', 'text', 'placeholder="إذا فارغ يتسوّى رقم تلقائي"'))}${fld('ملاحظات', ta('note', e.note))}</details>
    <p class="hint">أجور الشحن تنخصم تلقائياً من رصيدك عند شركة الشحن.</p>`;
  openModal(s0 ? 'تعديل شحنة' : 'شحنة جديدة', body, {
    back,
    del: s0 ? ['shipments', s0.id] : null,
    onOpen: f => {
      comboPaint('cbOrd');
      initDur(f, ['eta']);
      f.addEventListener('input', ev => {
        if (ev.target.classList.contains('cb-q')) comboList(ev.target.closest('.combo').id);
      });
    },
    onSubmit: async f => {
      const carrierId = WS.car;
      if (!byId('carriers', carrierId)) {
        ferr('اختر شركة الشحن');
        return;
      }
      const cost = r2(num2(f.elements.cost.value));
      if (cost < 0) {
        ferr('المبلغ لا يمكن أن يكون سالب', 'cost');
        return;
      }
      if (
        cost > 0 &&
        !(+e.cost > 0) &&
        WS.ord &&
        S.ctx.some(x => x.type === 'fee' && x.ft === 'شحن' && x.carrierId === carrierId && x.orderId === WS.ord)
      ) {
        ferr('أجور شحن هذا الطلب مسجلة من زر «شحن ونقل». اترك أجور الشحن فارغة هنا حتى ما تنحسب مرتين.', 'cost');
        return;
      }
      const dd = val(f, 'departDate'),
        eta = val(f, 'eta');
      if (dd && eta && eta < dd) {
        ferr('موعد الوصول لا يمكن أن يسبق تاريخ المغادرة', 'eta');
        return;
      }
      let ref = val(f, 'ref');
      if (ref && S.shipments.some(x => x.id !== e.id && x.carrierId === carrierId && norm(x.ref) === norm(ref))) {
        ferr('توجد شحنة بنفس الرقم لدى شركة الشحن هذه.', 'ref');
        return;
      }
      if (!ref) {
        const o = WS.ord && byId('orders', WS.ord);
        const base = 'ش-' + (o && o.ref ? o.ref : (dd || todayISO()).slice(5).replace('-', ''));
        let k = 1,
          r = base;
        while (S.shipments.some(x => x.id !== e.id && norm(x.ref) === norm(r))) r = base + '-' + ++k;
        ref = r;
      }
      const paidAmount = Math.min(+e.paidAmount || 0, cost);
      await put(
        'shipments',
        Object.assign({}, e, {
          id: e.id || newId('shipments'),
          createdAt: e.createdAt || Date.now(),
          ref,
          carrierId,
          orderId: WS.ord || '',
          cost,
          currency: WS.cur,
          paidAmount,
          status: WS.st,
          departDate: dd,
          eta,
          note: val(f, 'note')
        })
      );
      WCAR = carrierId;
      closeModal();
      toast('تم حفظ الشحنة');
    }
  });
}
function askDelete(col, id) {
  const back = M.back;
  let label = '',
    warn = '';
  if (col === 'orders') {
    const o = byId('orders', id);
    if (!o) return;
    label = 'الطلب ' + o.ref;
    const viaP = S.payments.filter(p => p.orderId === id && p.paid && p.via && byId('carriers', p.via));
    if (viaP.length) {
      openModal(
        'لا يمكن الحذف',
        '<p>الطلب <b>' +
          esc(o.ref) +
          '</b> عليه ' +
          viaP.length +
          ' دفعة دفعتها شركة الشحن من رصيدك. إذا ينحذف الطلب، هاي المبالغ ترجع لرصيدك وكأنها ما انصرفت.</p><p style="color:var(--mute)">إذا فعلاً تريد تحذفه، احذف دفعاته أول من داخل الطلب.</p><div class="mf"><button type="button" class="btn" data-act="close">حسناً</button></div>',
        { back }
      );
      return;
    }
    const np = S.payments.filter(p => p.orderId === id).length,
      ns = S.shipments.filter(s => s.orderId === id).length;
    warn = (np ? 'ستُحذف ' + np + ' دفعة مسجّلة عليه. ' : '') + (ns ? 'وتبقى ' + ns + ' شحنة بدون ربط بالطلب.' : '');
  } else if (col === 'payments') {
    const p = byId('payments', id);
    if (!p) return;
    const o = byId('orders', p.orderId);
    label = 'الدفعة ' + num(p.amount) + ' ' + (CUR[o && o.currency] || '') + (p.label ? ' (' + p.label + ')' : '');
    const vc = p.paid && p.via && byId('carriers', p.via);
    if (vc)
      warn =
        'هاي الدفعة دفعتها ' +
        vc.name +
        '. بعد الحذف رصيدك عندهم يرجع يزيد ' +
        num(p.amount) +
        ' ' +
        (CUR[o && o.currency] || '') +
        '.';
  } else if (col === 'shipments') {
    const s = byId('shipments', id);
    if (!s) return;
    label = 'الشحنة ' + s.ref;
  } else if (col === 'factories') {
    const f = byId('factories', id);
    if (!f) return;
    label = 'المصنع ' + f.name;
    const n = S.orders.filter(o => o.factoryId === id).length;
    if (n) {
      openModal(
        'لا يمكن الحذف',
        '<p>المصنع <b>' +
          esc(f.name) +
          '</b> عليه ' +
          n +
          ' طلب. احذف طلباته أو انقلها أولاً حتى لا تضيع سجلاتك.</p><div class="mf"><button type="button" class="btn" data-act="close">حسناً</button></div>',
        { back }
      );
      return;
    }
  } else if (col === 'ledger') {
    const l = byId('ledger', id);
    if (!l) return;
    label = labelOf('ledger', l);
  } else if (col === 'ctx') {
    const l = byId('ctx', id);
    if (!l) return;
    label = labelOf('ctx', l);
  } else if (col === 'companies') {
    const c = S.companies.find(x => x.id === id);
    if (!c) return;
    label = 'الشركة ' + c.name;
    const n = SCOPED.reduce((a, k) => a + RAW[k].filter(d => cid(d) === id).length, 0);
    if (n || id === DEFAULT_CO) {
      openModal(
        'لا يمكن الحذف',
        '<p>الشركة <b>' +
          esc(c.name) +
          '</b> فيها ' +
          n +
          ' سجل. لا تُحذف شركة عليها سجلات حتى لا تضيع بياناتك.</p><div class="mf"><button type="button" class="btn" data-act="close">حسناً</button></div>',
        { back }
      );
      return;
    }
  } else if (col === 'carriers') {
    const c = byId('carriers', id);
    if (!c) return;
    label = 'شركة الشحن ' + c.name;
    const n =
      S.shipments.filter(s => s.carrierId === id).length +
      S.ctx.filter(x => x.carrierId === id).length +
      S.payments.filter(p => p.via === id).length;
    if (n) {
      openModal(
        'لا يمكن الحذف',
        '<p>شركة الشحن <b>' +
          esc(c.name) +
          '</b> عليها ' +
          n +
          ' حركة (فلوس، دفعات أو شحنات). ما تنحذف حتى ما يضيع كشف حسابها.</p><div class="mf"><button type="button" class="btn" data-act="close">حسناً</button></div>',
        { back }
      );
      return;
    }
  }
  openModal(
    'تأكيد الحذف',
    `<p>سيتم حذف <b>${esc(label)}</b> نهائياً ولا يمكن التراجع.${warn ? '<br>' + esc(warn) : ''}</p><div class="mf"><button type="button" class="btn ghost" data-act="close">تراجع</button><button type="button" class="btn danger" data-act="del-ok" data-col="${col}" data-id="${id}">حذف نهائياً</button></div>`,
    { back }
  );
}
async function doDelete(col, id) {
  try {
    if (col === 'orders') {
      const np = S.payments.filter(p => p.orderId === id).length;
      const lbl = labelOf('orders', byId('orders', id)) + (np ? ' (مع ' + np + ' دفعة)' : '');
      for (const p of S.payments.filter(p => p.orderId === id)) await remove('payments', p.id, { quiet: true });
      for (const s of S.shipments.filter(s => s.orderId === id))
        await put('shipments', Object.assign({}, s, { orderId: '' }), { quiet: true });
      const od = byId('orders', id);
      for (const f of (od && od.files) || [])
        try {
          await dropFile(f.id);
        } catch (e) {}
      await remove(col, id, { label: lbl });
    } else {
      if (col === 'ctx') {
        const cx = byId('ctx', id);
        for (const f of (cx && cx.files) || [])
          try {
            await dropFile(f.id);
          } catch (e) {}
      }
      await remove(col, id, col === 'companies' ? { label: 'الشركة ' + coName(id) } : undefined);
    }
    if (col === 'companies' && ACTIVE === id) switchCompany(DEFAULT_CO);
    if (col === 'orders' || col === 'factories' || col === 'carriers') M.back = null;
    closeModal();
    toast('تم الحذف');
  } catch (e) {}
}
