/* Accounts (Guangzhou / Yiwu): switching and balances */
const DEFAULT_CO = 'main';
let ACTIVE = null;
const cid = d => d.companyId || DEFAULT_CO;
function coName(id) {
  const c = S.companies.find(x => x.id === id);
  return c ? c.name : '—';
}
function setCompanies(list) {
  let l = list.slice();
  if (LOCK_CO) {
    l = l.filter(c => c.id === LOCK_CO);
    if (!l.length) l.push({ id: LOCK_CO, name: LOCK_CO === 'yiwu' ? 'ايو' : LOCK_CO, virtual: true });
  }
  if (!LOCK_CO && !l.some(c => c.id === DEFAULT_CO)) l.push({ id: DEFAULT_CO, name: 'الشركة الرئيسية', virtual: true });
  l.sort(
    (a, b) => (a.id === DEFAULT_CO ? -1 : 0) - (b.id === DEFAULT_CO ? -1 : 0) || (a.createdAt || 0) - (b.createdAt || 0)
  );
  S.companies = l;
  let sv = null;
  try {
    sv = localStorage.getItem('ts_company');
  } catch (e) {}
  if (!ACTIVE || !l.some(c => c.id === ACTIVE)) ACTIVE = sv && l.some(c => c.id === sv) ? sv : l[0].id;
  SCOPED.forEach(c => {
    S[c] = RAW[c].filter(d => cid(d) === ACTIVE);
  });
}
function switchCompany(id) {
  if (!S.companies.some(c => c.id === id)) return;
  ACTIVE = id;
  try {
    localStorage.setItem('ts_company', id);
  } catch (e) {}
  SCOPED.forEach(c => {
    S[c] = RAW[c].filter(d => cid(d) === ACTIVE);
  });
  Object.keys(FL).forEach(k => {
    FL[k].q = '';
    FL[k].st = '';
  });
  setCar('');
  WCAR = null;
  closeModal(true);
  render();
  window.scrollTo(0, 0);
  const vw = $('#view');
  if (vw) {
    vw.classList.remove('enter');
    void vw.offsetWidth;
    vw.classList.add('enter');
  }
}
function cstats(id) {
  const co = S.companies.find(c => c.id === id) || {};
  const z = () => ({ USD: 0, CNY: 0 }),
    bal = z(),
    paid = z(),
    commit = z(),
    dep = z(),
    out = z();
  const key = c => (c === 'CNY' ? 'CNY' : 'USD');
  bal.USD = +co.openUSD || 0;
  bal.CNY = +co.openCNY || 0;
  RAW.ledger
    .filter(l => cid(l) === id)
    .forEach(l => {
      const a = +l.amount || 0,
        k = key(l.currency);
      if (l.type === 'out') {
        bal[k] -= a;
        out[k] += a;
      } else {
        bal[k] += a;
        dep[k] += a;
      }
    });
  RAW.orders
    .filter(o => cid(o) === id)
    .forEach(o => {
      const k = key(o.currency);
      const pd = RAW.payments.filter(p => p.orderId === o.id && p.paid).reduce((a, p) => a + (+p.amount || 0), 0);
      paid[k] += pd;
      bal[k] -= pd;
      commit[k] += Math.max(itemsTotal(o) - pd, 0);
    });
  ['USD', 'CNY'].forEach(k => {
    [bal, paid, commit, dep, out].forEach(o => (o[k] = r2(o[k])));
  });
  return {
    bal,
    paid,
    commit,
    dep,
    out,
    open: { USD: +co.openUSD || 0, CNY: +co.openCNY || 0 },
    limit: { USD: +co.limitUSD || 0, CNY: +co.limitCNY || 0 },
    co
  };
}
function coBlock(st) {
  return ['USD', 'CNY']
    .filter(k => st.bal[k] || st.commit[k] || st.limit[k] || st.dep[k] || st.paid[k])
    .map(k => {
      const lim = st.limit[k],
        use = st.commit[k],
        pct = lim ? Math.min(100, (use / lim) * 100) : 0,
        avail = lim ? lim - use : null;
      const cell = (l, v, bad) => `<div><small>${l}</small><b${bad ? ' class="neg"' : ''}>${v}</b></div>`;
      return `<div class="cob"><div class="cob-h"><small>رصيد الحساب · ${k === 'USD' ? 'دولار $' : 'يوان ¥'}</small><b class="${st.bal[k] < 0 ? 'neg' : ''}">${st.bal[k] < 0 ? 'عليك ' + money(-st.bal[k], k) : money(st.bal[k], k)}</b></div>
    <div class="cob-g">${cell('الالتزامات', money(use, k))}${lim ? cell('الحد', money(lim, k)) + cell('المتاح', money(avail, k), avail < 0) : ''}</div>
    ${lim ? `<div class="prog" role="img" aria-label="استهلاك الحد ${Math.round(pct)} بالمئة"><i class="p1" style="width:${pct}%;background:${use > lim ? 'var(--bad)' : pct > 85 ? 'var(--warn)' : 'var(--ok)'}"></i></div>` : ''}</div>`;
    })
    .join('');
}
function companyCard() {
  const st = cstats(ACTIVE),
    rows = coBlock(st);
  return `<div class="card"><h3>حساب «${esc(coName(ACTIVE))}» <button class="btn ghost sm" data-act="open-company" data-id="${ACTIVE}">${ico('db', 14)} التفاصيل</button></h3>${rows || `<span style="color:var(--mute)">لم تُضبط أرصدة هذه الشركة بعد.${CANEDIT ? ' افتح التفاصيل لإضافة الرصيد الافتتاحي أو الحد.' : ''}</span>`}</div>`;
}
function companyForm(c0, back) {
  const e = c0 || {};
  openModal(
    c0 ? 'تعديل الحساب' : 'حساب جديد',
    `${fld('اسم الحساب (مثلاً كوانزو أو ايو)', inp('name', e.name, 'text', 'required'))}${fld('ملاحظات', ta('note', e.note))}<div class="hint">كل حساب منفصل بالكامل: مصانعه وطلباته ودفعاته وشركة الشحن مالته. تبدّل بين الحسابات من الزر اللي فوك.</div>`,
    {
      back,
      del: c0 && !c0.virtual && c0.id !== DEFAULT_CO ? ['companies', c0.id] : null,
      onSubmit: async f => {
        const name = val(f, 'name');
        if (!name) {
          ferr('اكتب اسم الحساب', 'name');
          return;
        }
        if (S.companies.some(x => x.id !== e.id && norm(x.name) === norm(name))) {
          ferr('يوجد حساب بنفس الاسم', 'name');
          return;
        }
        const id = e.id || newId('companies');
        await put('companies', {
          id,
          createdAt: e.createdAt || Date.now(),
          name,
          openUSD: +e.openUSD || 0,
          openCNY: +e.openCNY || 0,
          limitUSD: +e.limitUSD || 0,
          limitCNY: +e.limitCNY || 0,
          note: val(f, 'note')
        });
        closeModal();
        toast('تم حفظ الحساب');
      }
    }
  );
}
function ledgerForm(companyId) {
  openModal(
    'حركة على الحساب',
    `<div class="grid2">${fld(
      'النوع',
      sel(
        'type',
        [
          ['in', 'إيداع (دخل للحساب)'],
          ['out', 'سحب (خرج من الحساب)']
        ],
        'in'
      )
    )}${fld(
      'العملة',
      sel(
        'currency',
        [
          ['USD', 'دولار $'],
          ['CNY', 'يوان ¥']
        ],
        'USD'
      )
    )}${fld('المبلغ', inp('amount', '', 'number', 'required'))}${fld('التاريخ', inp('date', todayISO(), 'date'))}</div>${fld('ملاحظة', inp('note', ''))}`,
    {
      back: () => openCompany(companyId),
      onSubmit: async f => {
        const amount = parseFloat(val(f, 'amount'));
        if (!(amount > 0)) {
          ferr('اكتب مبلغاً أكبر من صفر', 'amount');
          return;
        }
        await put('ledger', {
          id: newId('ledger'),
          companyId,
          type: val(f, 'type'),
          currency: val(f, 'currency'),
          amount: r2(amount),
          date: val(f, 'date') || todayISO(),
          note: val(f, 'note'),
          at: Date.now()
        });
        closeModal();
        toast('تم تسجيل الحركة');
      }
    }
  );
}
function openCompany(id) {
  const draw = () => {
    const co = S.companies.find(c => c.id === id);
    if (!co) {
      closeModal(true);
      return '';
    }
    const st = cstats(id);
    const led = RAW.ledger
      .filter(l => cid(l) === id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || 0) - (a.at || 0))
      .slice(0, 60);
    const rows = led
      .map(
        l =>
          `<li><div class="t"><b>${l.type === 'out' ? 'سحب' : 'إيداع'} · ${money(l.amount, l.currency)}</b><small>${fmtD(l.date)}${l.note ? ' · ' + esc(l.note) : ''}</small></div><div class="r">${ADMIN ? `<button class="icon" data-act="del-ask" data-col="ledger" data-id="${l.id}" aria-label="حذف">${ico('trash', 16)}</button>` : ''}</div></li>`
      )
      .join('');
    return `${coBlock(st) || '<div class="hint">لا توجد أرقام بعد. أضف رصيداً افتتاحياً أو إيداعاً.</div>'}
    ${co.note ? `<div class="hint">${esc(co.note)}</div>` : ''}
    <div><h3 style="margin-bottom:6px">حركات الحساب</h3><ul class="list">${rows || '<li style="color:var(--mute)">لا توجد حركات</li>'}</ul></div>
    <div class="mf">${id !== ACTIVE ? `<button class="btn ghost" type="button" data-act="use-company" data-id="${id}">التحويل لهذه الشركة</button>` : ''}<button class="btn ghost" type="button" data-act="edit-company" data-id="${id}">${ico('edit', 16)} إعدادات</button><button class="btn" type="button" data-act="new-ledger" data-id="${id}">${ico('plus', 16)} إيداع / سحب</button></div>`;
  };
  const co = S.companies.find(c => c.id === id);
  if (!co) return;
  openModal(co.name, draw(), {
    wide: true,
    refresh: () => {
      const f = $('#mform');
      if (f) {
        const h = draw();
        if (h) f.innerHTML = h;
      }
    }
  });
}
function withAcct(id, fn) {
  const keep = {};
  SCOPED.forEach(c => {
    keep[c] = S[c];
    S[c] = RAW[c].filter(d => cid(d) === id);
  });
  try {
    return fn();
  } finally {
    SCOPED.forEach(c => {
      S[c] = keep[c];
    });
  }
}
function acctSummary(id) {
  return withAcct(id, () => {
    const w = {},
      r = {};
    S.carriers.forEach(c => {
      const b = walletBal(c.id);
      Object.keys(b).forEach(k => addTo(w, k, b[k]));
    });
    S.orders.forEach(o => addTo(r, o.currency, ordRem(o)));
    return {
      w,
      r,
      open: S.orders.filter(o => o.stage !== 'received').length,
      car: S.carriers.map(c => c.name).join('، ')
    };
  });
}
function companiesView() {
  return `<div class="cards">${S.companies
    .map(c => {
      const a = acctSummary(c.id);
      return `<div class="card"><h3>${esc(c.name)} ${c.id === ACTIVE ? pill('ok', 'الحالي') : ''}</h3>
     <div class="mini"><span>شركة الشحن</span><b>${esc(a.car || '—')}</b></div>
     <div class="mini"><span>رصيدك عندهم</span><b>${balLine(a.w)}</b></div>
     <div class="mini"><span>المتبقي للمصانع</span><b>${multi(a.r)}</b></div>
     <div class="mini"><span>طلبات مفتوحة</span><b>${a.open}</b></div>
     <div class="bar" style="margin-top:10px">${c.id !== ACTIVE ? `<button class="btn sm" data-act="acct" data-id="${esc(c.id)}">فتح الحساب</button>` : ''}<button class="btn ghost sm" data-act="edit-company" data-id="${esc(c.id)}">${ico('edit', 14)} تعديل الاسم</button></div></div>`;
    })
    .join('')}</div>`;
}
