/* Data layer: live collections, company scoping, put/remove, activity log */
const COLS = ['factories', 'orders', 'payments', 'carriers', 'shipments'];
const SCOPED = [...COLS, 'ledger', 'ctx'],
  LOADS = [...SCOPED, 'companies'],
  RAW = {};
const S = {};
LOADS.forEach(c => {
  S[c] = [];
  RAW[c] = [];
});
const loaded = {};
let db = null,
  dbFail = false;
let CANEDIT = false,
  LOCK_CO = null;
let ADMIN = false,
  SB = null,
  SBDB = null,
  ME = null,
  PROFILES = {};
const ADMIN_COLS = ['payments', 'factories', 'carriers', 'companies', 'ledger', 'ctx'];
let ACT = [],
  actLoaded = false,
  META = {},
  metaLoaded = false,
  myId = null,
  userNS = null;
const byId = (col, id) => S[col].find(x => x.id === id);
let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    refresh();
  });
}
async function init() {
  db = SBDB;
  if (!db) {
    dbFail = true;
    render();
    return;
  }
  myId = ME.id;
  ADMIN = ME.role === 'admin';
  CANEDIT = ADMIN || ME.role === 'staff';
  userNS = {
    profiles: async ids => {
      const o = {};
      [].concat(ids).forEach(i => {
        const p = PROFILES[i];
        o[i] = { id: i, name: p ? p.name || p.email : '', isMe: i === myId };
      });
      return o;
    }
  };
  document.body.classList.toggle('ro', !CANEDIT);
  document.body.classList.toggle('nodel', !ADMIN);
  schedule();
  try {
    db.collection('activity')
      .orderBy('at', 'desc')
      .limit(150)
      .onSnapshot(
        snap => {
          ACT = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
          actLoaded = true;
          if (cur === 'activity') schedule();
        },
        () => {
          actLoaded = true;
        }
      );
  } catch (e) {}
  try {
    db.doc('meta/backup').onSnapshot(
      sn => {
        META.backup = sn.exists ? sn.data() : null;
        metaLoaded = true;
        if (cur === 'home' || cur === 'backup') schedule();
      },
      () => {
        metaLoaded = true;
      }
    );
  } catch (e) {}
  LOADS.forEach(name => {
    db.collection(name).onSnapshot(
      snap => {
        RAW[name] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        if (name === 'companies') setCompanies(RAW.companies);
        else if (SCOPED.includes(name)) S[name] = RAW[name].filter(d => cid(d) === ACTIVE);
        loaded[name] = true;
        schedule();
      },
      e => {
        dbFail = true;
        toast('تعذر تحميل البيانات', 'bad');
        render();
      }
    );
  });
}
const newId = col => db.collection(col).doc().id;
const COL_TXT = {
  factories: 'مصنع',
  orders: 'طلب',
  payments: 'دفعة',
  carriers: 'شركة شحن',
  shipments: 'شحنة',
  companies: 'شركة',
  ledger: 'حركة حساب',
  ctx: 'حركة شركة شحن'
};
function labelOf(col, o) {
  if (!o) return '';
  if (col === 'factories' || col === 'carriers' || col === 'companies') return o.name || '';
  if (col === 'ctx')
    return (
      (o.type === 'in' ? 'تحويل لـ ' : o.type === 'fee' ? 'مصروف عند ' : '') +
      ((byId('carriers', o.carrierId) || {}).name || '') +
      ' · ' +
      num(o.amt) +
      ' ' +
      (CUR[o.cur] || '')
    );
  if (col === 'ledger')
    return (
      (o.type === 'out' ? 'سحب ' : 'إيداع ') +
      num(o.amount) +
      ' ' +
      (CUR[o.currency] || '') +
      ' · ' +
      coName(o.companyId)
    );
  if (col === 'orders') return (o.ref || '') + ' · ' + factoryName(o.factoryId);
  if (col === 'shipments') return o.ref || '';
  if (col === 'payments') {
    const ord = byId('orders', o.orderId);
    return (
      (ord ? ord.ref : '—') +
      ' · ' +
      num(o.amount) +
      ' ' +
      (CUR[ord && ord.currency] || '') +
      (o.label ? ' · ' + o.label : '')
    );
  }
  return '';
}
function logAct(act, col, label) {
  if (!db) return;
  try {
    db.collection('activity')
      .add({
        at: Date.now(),
        by: myId || '',
        companyId: ACTIVE || DEFAULT_CO,
        act,
        col: col || '',
        label: String(label || '').slice(0, 200)
      })
      .catch(() => {});
  } catch (e) {}
}
async function put(col, obj, opts) {
  opts = opts || {};
  if (!CANEDIT && ADMIN_COLS.includes(col)) {
    toast('ما عندك صلاحية لهذا الإجراء', 'bad');
    throw new Error('admin_only');
  }
  const { id, ...rest } = obj;
  const old = byId(col, id);
  if (SCOPED.includes(col) && !rest.companyId) rest.companyId = ACTIVE || DEFAULT_CO;
  try {
    await db.collection(col).doc(id).set(rest);
  } catch (e) {
    toast(
      e && e.code === 'quota_exceeded' ? 'امتلأت سعة قاعدة البيانات' : 'تعذر الحفظ. تحقق من صلاحيات التعديل',
      'bad'
    );
    throw e;
  }
  if (!opts.quiet) {
    let act = old ? 'edit' : 'add',
      extra = '';
    if (col === 'payments' && obj.paid && !(old && old.paid)) act = 'pay';
    if (col === 'orders' && old && old.stage !== obj.stage) {
      act = 'stage';
      extra = ' ← ' + stageName(obj.stage);
    }
    logAct(act, col, labelOf(col, obj) + extra);
  }
}
async function remove(col, id, opts) {
  opts = opts || {};
  if (!ADMIN) {
    toast('الحذف للمدير فقط', 'bad');
    throw new Error('admin_only');
  }
  const old = byId(col, id);
  try {
    await db.collection(col).doc(id).delete();
  } catch (e) {
    toast('تعذر الحذف', 'bad');
    throw e;
  }
  if (!opts.quiet) logAct('delete', col, opts.label || labelOf(col, old));
}
