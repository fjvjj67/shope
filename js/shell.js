/* App shell: navigation, render loop, click/keyboard actions */
const NAV = [
  ['home', 'الرئيسية', 'home'],
  ['orders', 'الطلبات', 'box'],
  ['shipments', 'الشحنات', 'ship'],
  ['factories', 'المصانع', 'factory'],
  ['companies', 'الحسابات', 'building'],
  ['activity', 'سجل النشاط', 'clock'],
  ['users', 'المستخدمون', 'users'],
  ['backup', 'الملفات والنسخ', 'db'],
  ['logout', 'تسجيل الخروج', 'out']
];
const TITLES = {
  home: 'الرئيسية',
  orders: 'الطلبات',
  payments: 'الدفعات',
  shipments: 'الشحنات',
  factories: 'المصانع',
  carriers: 'شركات الشحن',
  companies: 'الحسابات',
  activity: 'سجل النشاط',
  backup: 'الملفات والنسخ الاحتياطي',
  users: 'المستخدمون'
};
const ADD = {
  orders: ['طلب جديد', 'new-order'],
  payments: ['دفعة جديدة', 'new-payment'],
  shipments: ['شحنة جديدة', 'new-shipment'],
  factories: ['مصنع جديد', 'new-factory'],
  carriers: ['شركة شحن', 'new-carrier'],
  companies: ['حساب جديد', 'new-company']
};
let cur = 'home';
try {
  const h = location.hash.slice(1);
  if (NAV.some(n => n[0] === h)) cur = h;
} catch (e) {}
function go(v) {
  cur = v;
  try {
    history.replaceState(null, '', '#' + v);
  } catch (e) {}
  render();
  window.scrollTo(0, 0);
  const vw = $('#view');
  if (vw) {
    vw.classList.remove('enter');
    void vw.offsetWidth;
    vw.classList.add('enter');
  }
}
function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'صباح الخير' : h < 18 ? 'مرحباً' : 'مساء الخير';
}
const MAIN = ['home', 'orders', 'shipments', 'factories'];
const ADMIN_NAV = ['companies', 'users'];
const navOk = n => (n[0] === 'users' ? ADMIN : !ADMIN_NAV.includes(n[0]) || CANEDIT);
function shell() {
  $('#side').innerHTML =
    '<div class="brand"><i></i>الطلبات والشحن</div><div class="acsw side-sw" id="acswSide" role="tablist" aria-label="الحساب" hidden></div>' +
    NAV.filter(navOk)
      .map(
        n =>
          `<button class="nav ${MAIN.includes(n[0]) ? '' : 'sec'}" data-act="nav" data-view="${n[0]}" ${n[0] === cur ? 'aria-current="page"' : ''}>${ico(n[2])}<span>${n[1]}</span></button>`
      )
      .join('') +
    `<button class="nav morebtn" data-act="more" aria-haspopup="true" ${MAIN.includes(cur) ? '' : 'aria-current="page"'}>${ico('menu')}<span>المزيد</span></button>`;
  const mr = $('#more');
  mr.hidden = true;
  mr.firstElementChild.innerHTML = NAV.filter(n => !MAIN.includes(n[0]) && navOk(n))
    .map(
      n =>
        `<button class="sheetbtn" data-act="nav" data-view="${n[0]}" ${n[0] === cur ? 'aria-current="page"' : ''}>${ico(n[2], 24)}<span>${n[1]}</span></button>`
    )
    .join('');
  $('#title').textContent = cur === 'home' ? '' : TITLES[cur];
  document.body.classList.toggle('pg-home', cur === 'home');
  $('#sub').textContent = new Date().toLocaleDateString(document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const swH =
    S.companies.length > 1
      ? S.companies
          .map(
            c =>
              `<button type="button" role="tab" data-act="acct" data-id="${esc(c.id)}" aria-selected="${c.id === ACTIVE}"><i></i>${esc(c.name)}</button>`
          )
          .join('')
      : '';
  const st = $('#acswTop');
  if (st) {
    st.innerHTML = swH;
    st.hidden = !swH;
  }
  const ss = $('#acswSide');
  if (ss) {
    ss.innerHTML = swH;
    ss.hidden = !swH;
  }
  const cs = $('#cosel');
  if (cs)
    cs.innerHTML = S.companies
      .map(c => `<option value="${esc(c.id)}"${c.id === ACTIVE ? ' selected' : ''}>${esc(c.name)}</option>`)
      .join('');
  document.body.classList.toggle('hasfab', !!ADD[cur]);
  const a = ADD[cur];
  $('#topact').innerHTML = a ? `<button class="btn" data-act="${a[1]}">${ico('plus')} ${a[0]}</button>` : '';
}
function render() {
  shell();
  const v = $('#view');
  if (dbFail) {
    v.innerHTML = empty(
      'تعذر الوصول إلى قاعدة البيانات',
      'تحقق من الاتصال بالإنترنت ثم أعد تحميل الصفحة، وتأكد أن حسابك مفعّل من المدير.'
    );
    return;
  }
  if (LOADS.some(c => !loaded[c])) {
    v.innerHTML = '<div class="skel"></div><div class="skel"></div>';
    return;
  }
  if (cur === 'home') v.innerHTML = dashboard();
  else if (LISTS[cur]) {
    const opts = {
      orders: [
        ['', 'كل الطلبات'],
        ['open', 'المفتوحة'],
        ['late', 'المتأخرة'],
        ['recv', 'استلام قريب أو متأخر'],
        ['unpaid', 'عليها متبقٍ'],
        ['production', 'قيد التصنيع'],
        ['ready', 'جاهزة للشحن'],
        ['shipped', 'تم الشحن'],
        ['received', 'المستلمة']
      ],
      payments: [
        ['', 'كل الدفعات'],
        ['unpaid', 'غير مدفوعة'],
        ['soon', 'تستحق خلال ٧ أيام'],
        ['late', 'متأخرة'],
        ['paid', 'مدفوعة']
      ],
      shipments: [
        ['', 'كل الشحنات'],
        ['preparing', 'قيد التجهيز'],
        ['transit', 'بالطريق'],
        ['arrived', 'وصلت']
      ]
    }[cur];
    v.innerHTML = toolbar(cur, opts);
    $('#list').innerHTML = LISTS[cur]();
    $('#q_' + cur).addEventListener('input', e => {
      FL[cur].q = e.target.value;
      $('#list').innerHTML = LISTS[cur]();
    });
    $('#s_' + cur).addEventListener('change', e => {
      FL[cur].st = e.target.value;
      $('#list').innerHTML = LISTS[cur]();
    });
  } else if (cur === 'factories') v.innerHTML = factoriesView();
  else if (cur === 'carriers') v.innerHTML = carriersView();
  else if (cur === 'companies') {
    v.innerHTML = CANEDIT ? companiesView() : empty('للمدير فقط', 'إدارة الشركات والحسابات متاحة للمدير.');
  } else if (cur === 'users') {
    v.innerHTML = usersView();
    loadProfiles();
  } else if (cur === 'activity') {
    v.innerHTML = activityView();
    fillNames();
  } else v.innerHTML = backupView();
  const rf = $('#restoreFile');
  if (rf)
    rf.addEventListener('change', e => {
      const fl = e.target.files[0];
      e.target.value = '';
      if (!ADMIN) {
        toast('الاستعادة للمدير فقط', 'bad');
        return;
      }
      if (fl) restoreFile(fl);
    });
}
function refresh() {
  if (LOADS.some(c => !loaded[c])) {
    return;
  }
  const l = $('#list');
  if (l && LISTS[cur] && $('#view .skel') == null) {
    l.innerHTML = LISTS[cur]();
  } else render();
  if (M.refresh) M.refresh();
}

/* ---------- actions ---------- */
const ADMIN_ACTS = new Set([
  'w-confirm',
  'nf-toggle',
  'ship-next',
  'w-in',
  'w-pay',
  'w-fee',
  'sched-pay',
  'pay-order',
  'new-company',
  'edit-company',
  'new-ledger',
  'new-payment',
  'edit-payment',
  'pay-now',
  'new-factory',
  'edit-factory',
  'new-carrier',
  'edit-carrier'
]);
const DEL_ACTS = new Set([
  'lb-del',
  'del-file',
  'del-file-ok',
  'del-ask',
  'del-ok',
  'demo-load',
  'demo-clear',
  'pick-restore'
]);
document.addEventListener('click', e => {
  if (e.target.id === 'more') {
    e.target.hidden = true;
    return;
  }
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.tagName === 'TR' && e.target.closest('button,a')) return;
  const d = t.dataset,
    id = d.id;
  if (!CANEDIT && ADMIN_ACTS.has(d.act)) {
    toast('ما عندك صلاحية لهذا الإجراء', 'bad');
    return;
  }
  if (!ADMIN && DEL_ACTS.has(d.act)) {
    toast('الحذف للمدير فقط', 'bad');
    return;
  }
  switch (d.act) {
    case 'nav':
      if (d.view === 'logout') {
        logout();
        break;
      }
      closeModal(true);
      if (FL[d.view]) {
        FL[d.view].q = '';
        FL[d.view].st = d.st || '';
      }
      go(d.view);
      break;
    case 'close':
      closeModal();
      break;
    case 'more': {
      const mr = $('#more');
      mr.hidden = !mr.hidden;
      break;
    }
    case 'new-factory':
      factoryForm(null, M.back);
      break;
    case 'open-factory':
      openFactory(id);
      break;
    case 'edit-factory':
      factoryForm(byId('factories', id), M.el ? () => openFactory(id) : null);
      break;
    case 'new-carrier':
      carrierForm();
      break;
    case 'edit-carrier':
      carrierForm(byId('carriers', id));
      break;
    case 'new-order':
      orderForm();
      break;
    case 'open-order':
      openOrder(id);
      break;
    case 'edit-order':
      orderForm(byId('orders', id), () => openOrder(id));
      break;
    case 'new-payment': {
      const o = d.order;
      paymentForm(null, o, o ? () => openOrder(o) : null);
      break;
    }
    case 'edit-payment': {
      const p = byId('payments', id);
      paymentForm(p, null, M.el && p ? () => openOrder(p.orderId) : null);
      break;
    }
    case 'next-stage': {
      const o = byId('orders', id);
      if (o && NEXT[o.stage]) {
        const nx = NEXT[o.stage][0];
        put('orders', Object.assign({}, o, { stage: nx }))
          .then(() => toast('تم نقل الطلب إلى: ' + stageName(nx)))
          .catch(() => {});
      }
      break;
    }
    case 'pay-now':
      settleForm(id);
      break;
    case 'sched-pay':
      schedForm(d.order);
      break;
    case 'pay-order':
      walletForm('pay', d.order);
      break;
    case 'ship-next': {
      const sh = byId('shipments', id),
        nx = sh && { preparing: 'transit', transit: 'arrived' }[sh.status];
      if (nx)
        put(
          'shipments',
          Object.assign({}, sh, { status: nx }, nx === 'transit' && !sh.departDate ? { departDate: todayISO() } : {})
        )
          .then(() => toast(nx === 'arrived' ? 'تم: الشحنة وصلت' : 'تم: الشحنة بالطريق'))
          .catch(() => {});
      break;
    }
    case 'sh-st': {
      WS.st = d.v;
      document.querySelectorAll('[data-act=sh-st]').forEach(b => b.setAttribute('aria-pressed', b === t));
      break;
    }
    case 'ref-mode': {
      const f = $('#mform'),
        bb = $('#bnoBox'),
        rb = $('#refBox'),
        toB = bb.hidden;
      bb.hidden = !toB;
      rb.hidden = toB;
      if (toB && !f.elements.bno.value) f.elements.bno.value = nextBatch();
      t.textContent = toB ? 'اكتب رقم يدوي' : 'استخدم ترقيم الوجبات';
      if (f._bh) f._bh();
      (toB ? f.elements.bno : f.elements.ref).focus();
      break;
    }
    case 'new-shipment': {
      const o = d.order;
      shipmentForm(null, o, o ? () => openOrder(o) : null);
      break;
    }
    case 'edit-shipment': {
      const s = byId('shipments', id);
      shipmentForm(s, null, M.el && s && s.orderId ? () => openOrder(s.orderId) : null);
      break;
    }
    case 'add-item': {
      const b = $('#items');
      b.insertAdjacentHTML('beforeend', itemRow());
      b.lastElementChild.querySelector('.iname').focus();
      break;
    }
    case 'rm-item': {
      const r = t.closest('.irow');
      const b = $('#items');
      if (b.children.length > 1) r.remove();
      else r.querySelectorAll('input').forEach(i => (i.value = ''));
      updItemsTotal();
      break;
    }
    case 'pct': {
      const f = $('#mform'),
        o = f && byId('orders', f.elements.orderId.value);
      if (!o) break;
      const tot = itemsTotal(o);
      if (!tot) {
        ferr('اكتب إجمالي الطلب أولاً حتى تُحسب النسبة');
        break;
      }
      f.elements.amount.value = r2((tot * +d.pct) / 100);
      f.elements.amount.dispatchEvent(new Event('input', { bubbles: true }));
      break;
    }
    case 'use-suggest': {
      const f = $('#mform');
      if (!f) break;
      if (!f.dataset.sug) {
        toast('لا يوجد باقٍ لاقتراحه', 'bad');
        break;
      }
      f.elements.amount.value = f.dataset.sug;
      f.elements.amount.dispatchEvent(new Event('input', { bubbles: true }));
      break;
    }
    case 'pick-items':
      $('#itemsFile').click();
      break;
    case 'pick-restore':
      $('#restoreFile').click();
      break;
    case 'del-ask':
      askDelete(d.col, id);
      break;
    case 'open-company':
      openCompany(id);
      break;
    case 'new-company':
      companyForm(null, M.back);
      break;
    case 'edit-company':
      companyForm(
        S.companies.find(c => c.id === id),
        M.el ? () => openCompany(id) : null
      );
      break;
    case 'new-ledger':
      ledgerForm(id);
      break;
    case 'use-company':
      switchCompany(id);
      break;
    case 'pick-attach':
      $('#attachFile').click();
      break;
    case 'rm-pend':
      PEND.splice(+d.i, 1);
      renderAtt();
      break;
    case 'view-file':
      viewFile(id, d.order);
      break;
    case 'lb-close':
      closeLb();
      break;
    case 'w-car':
      setCar(id);
      render();
      break;
    case 'car-go':
      setCar(id);
      go('home');
      break;
    case 'acct':
      if (id !== ACTIVE) {
        switchCompany(id);
        toast('حساب ' + coName(id));
      }
      break;
    case 'w-stmt':
      stmtModal();
      break;
    case 'w-in':
      ensureCarrier().then(ok => ok && walletForm('in'));
      break;
    case 'w-pay':
      ensureCarrier().then(ok => ok && walletForm('pay'));
      break;
    case 'w-fee':
      ensureCarrier().then(ok => ok && walletForm('fee'));
      break;
    case 'w-pick':
      WS.car = id;
      document.querySelectorAll('[data-act=w-pick]').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
      wHint();
      break;
    case 'w-seg': {
      WS[d.k] = d.v;
      document
        .querySelectorAll(`[data-act=w-seg][data-k="${d.k}"]`)
        .forEach(b => b.setAttribute('aria-pressed', b === t));
      if (d.k === 'pm') {
        const f = $('#mform'),
          o = WS.ord && byId('orders', WS.ord);
        if (d.v === 'full' && o) f.elements.wAmt.value = ordRem(o);
        else if (d.v === 'part') f.elements.wAmt.value = '';
        const pc = $('#wPct');
        if (pc) pc.hidden = d.v === 'full';
      }
      wHint();
      break;
    }
    case 'nf-toggle': {
      const b = $('#nfBox');
      if (b) {
        b.hidden = !b.hidden;
        t.innerHTML = b.hidden ? ico('plus', 14) + ' مصنع جديد' : 'من القائمة';
        const fs = $('#mform').elements.factoryId;
        if (fs) fs.disabled = !b.hidden;
        if (!b.hidden)
          setTimeout(() => {
            const mf = $('#mform'),
              i = mf && mf.elements.newFactory;
            i && i.focus();
          }, 30);
      }
      break;
    }
    case 'sp-all': {
      const f = $('#mform');
      if (f && f.elements.amount) f.elements.amount.value = d.v;
      break;
    }
    case 'w-confirm':
      confirmForm(id);
      break;
    case 'view-rc':
      viewRc(id);
      break;
    case 'w-pct': {
      const o = WS.ord && byId('orders', WS.ord);
      if (!o) {
        ferr('اختر الطلب أولاً');
        break;
      }
      $('#mform').elements.wAmt.value = r2((ordRem(o) * +d.v) / 100);
      wHint();
      break;
    }
    case 'cb-toggle':
      comboToggle(id);
      break;
    case 'cb-pick': {
      WS.ord = id || null;
      comboToggle('cbOrd', false);
      comboPaint('cbOrd');
      const o = WS.ord && byId('orders', WS.ord);
      if (WS.kind === 'pay' && WS.pm === 'full' && o) $('#mform').elements.wAmt.value = ordRem(o);
      wHint();
      break;
    }
    case 'lb-dl':
      if (LB.fid) dlFile(LB.fid);
      break;
    case 'lb-del':
      if (LB.fid && LB.oid) delFileAsk(LB.fid, LB.oid);
      break;
    case 'dur':
      setDur(d.t, +d.d);
      break;
    case 'due': {
      const f = $('#mform');
      if (f && f.elements.dueDate) {
        f.elements.dueDate.value = addDays(todayISO(), +d.d);
        ['input', 'change'].forEach(n => f.elements.dueDate.dispatchEvent(new Event(n, { bubbles: true })));
      }
      break;
    }
    case 'dl-file':
      dlFile(id);
      break;
    case 'del-file':
      delFileAsk(id, d.order);
      break;
    case 'del-file-ok':
      delFileOk(id, d.order);
      break;
    case 'del-ok':
      doDelete(d.col, id);
      break;
    case 'export-xlsx':
      exportXlsx();
      break;
    case 'export-json':
      exportJson();
      break;
    case 'ui-theme':
      setUI(d.v);
      break;
    case 'ct-auto':
      I18N.setAuto(d.v === '1');
      break;
    case 'demo-load':
      demoLoad();
      break;
    case 'demo-clear':
      demoClear();
      break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (!t) return;
  if (t.id === 'cosel') switchCompany(t.value);
  if (t.id === 'carsel') {
    setCar(t.value);
    render();
  } else if (t.dataset && t.dataset.attachOrder) {
    const fl = [...t.files];
    t.value = '';
    attachToOrder(t.dataset.attachOrder, fl);
  }
});
document.addEventListener('click', e => {
  if (e.target && e.target.id === 'lb') closeLb();
  if (!e.target.closest || !e.target.closest('.combo'))
    document.querySelectorAll('.combo.open').forEach(c => comboToggle(c.id, false));
});
{
  const lb = document.getElementById('lb');
  if (lb) {
    lb.querySelector('[data-act=lb-dl]').innerHTML = ico('down', 18);
    lb.querySelector('[data-act=lb-del]').innerHTML = ico('trash', 18);
    lb.querySelector('[data-act=lb-close]').innerHTML = ico('x', 20);
  }
}
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr.click,.cards .card') && !e.target.closest('.mb')) {
    e.preventDefault();
    e.target.click();
  }
});
