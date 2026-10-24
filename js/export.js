/* Excel export, JSON backup and restore, demo data */
async function saveFile(filename, data) {
  try {
    const blob =
      data instanceof Blob
        ? data
        : new Blob([data], { type: /\.json$/.test(filename) ? 'application/json' : 'application/octet-stream' });
    const u = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    return true;
  } catch (e) {
    toast('تعذر حفظ الملف', 'bad');
    return false;
  }
}
const EXCELJS_SRC = 'lib/exceljs.min.js';
const loadScript = src =>
  new Promise((res, rej) => {
    const x = document.createElement('script');
    x.src = src;
    x.onload = res;
    x.onerror = () => rej(new Error('load'));
    document.head.appendChild(x);
  });
let xlsBusy = false;
function acctCode() {
  const n = (coName(ACTIVE) || '') + ' ' + S.carriers.map(c => c.name).join(' ');
  if (/كوان|قوان|guang/i.test(n)) return 'Guangzhou';
  if (/ا[يى]و|yiwu/i.test(n)) return 'Yiwu';
  const i = S.companies.findIndex(c => c.id === ACTIVE);
  return 'Account' + (i + 1);
}
// typed text + its translation in brackets, e.g. "义乌五金工厂 (مصنع ييوو للعدد)", so the file is readable by both sides
const xt = v => {
  if (!v) return '';
  const s = String(v),
    t = I18N.content(s);
  return t && t !== s ? s + ' (' + t + ')' : s;
};
async function exportXlsx() {
  if (xlsBusy) return;
  xlsBusy = true;
  try {
    toast('جارٍ تجهيز ملف Excel مع الصور…');
    if (!window.ExcelJS) {
      try {
        await loadScript(EXCELJS_SRC);
      } catch (e) {
        toast('تعذر تحميل مكتبة Excel. تحقق من الإنترنت', 'bad');
        return;
      }
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'AZAWI';
    wb.created = new Date();
    const sheet = (name, cols, rows) => {
      const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
      ws.columns = cols.map(c => ({ header: c[0], key: c[1], width: c[2] || 14, style: c[3] ? { numFmt: c[3] } : {} }));
      rows.forEach(r => ws.addRow(r));
      const h = ws.getRow(1);
      h.height = 26;
      h.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B3A3B' } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFF08A3C' } } };
      });
      ws.eachRow((row, i) => {
        if (i > 1) {
          row.alignment = { vertical: 'middle', wrapText: true };
          if (i % 2 === 0)
            row.eachCell({ includeEmpty: true }, c => {
              c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F6' } };
            });
        }
      });
      return ws;
    };
    const NF = '#,##0.00',
      IMG_COLS = 3;
    const oc = [
      ['رقم الطلب', 'ref', 14],
      ['المصنع', 'f', 20],
      ['تاريخ الطلب', 'od', 12],
      ['موعد التجهيز', 'pd', 12],
      ['موعد الاستلام', 'rd', 12],
      ['المرحلة', 'st', 13],
      ['العملة', 'cur', 8],
      ['الإجمالي', 'tot', 13, NF],
      ['المدفوع', 'paid', 13, NF],
      ['المتبقي', 'rem', 13, NF],
      ['حالة الدفع', 'pay', 12],
      ['ملاحظات', 'note', 26]
    ];
    const base = oc.length;
    for (let k = 1; k <= IMG_COLS; k++) oc.push(['صورة ' + k, 'img' + k, 19]);
    const orders = S.orders.slice().sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''));
    const ws = sheet(
      'الطلبات',
      oc,
      orders.map(o => {
        const i = oi(o);
        return {
          ref: o.ref,
          f: xt(factoryName(o.factoryId)),
          od: o.orderDate || '',
          pd: o.prepDate || '',
          rd: o.recvDate || '',
          st: stageName(o.stage),
          cur: o.currency,
          tot: i.total,
          paid: i.paid,
          rem: i.remaining,
          pay: i.pay[1],
          note: xt(o.note)
        };
      })
    );
    let gal = null,
      nImg = 0,
      miss = 0;
    for (let r = 0; r < orders.length; r++) {
      const o = orders[r],
        imgs = (o.files || []).filter(f => isImg(f.type));
      if (!imgs.length) continue;
      ws.getRow(r + 2).height = 100;
      for (let k = 0; k < imgs.length; k++) {
        const d = await loadFile(imgs[k].id).catch(() => null);
        if (!d) {
          miss++;
          continue;
        }
        let im;
        try {
          im = await loadImg(d.data);
        } catch (e) {
          miss++;
          continue;
        }
        const ar = im.naturalHeight / im.naturalWidth;
        if (k < IMG_COLS) {
          const id = wb.addImage({ base64: drawJpeg(im, 300, 0.8), extension: 'jpeg' });
          const w = ar > 1 ? Math.round(122 / ar) : 122,
            h = ar > 1 ? 122 : Math.round(122 * ar);
          ws.addImage(id, {
            tl: { col: base + k + 0.08, row: r + 1 + 0.08 },
            ext: { width: w, height: h },
            editAs: 'oneCell'
          });
        }
        if (!gal) {
          gal = wb.addWorksheet('كل الصور', { views: [{ rightToLeft: true }] });
          gal.columns = [
            { header: 'الطلب', key: 'o', width: 26 },
            { header: 'الصورة', key: 'i', width: 64 }
          ];
          const h = gal.getRow(1);
          h.font = { bold: true };
          h.height = 22;
        }
        const W = 440,
          H = Math.round(W * ar),
          row = gal.addRow({ o: o.ref + '\n' + factoryName(o.factoryId) + '\n' + (imgs[k].name || '') });
        row.height = Math.min(409, H * 0.75 + 10);
        row.alignment = { vertical: 'top', wrapText: true };
        const id2 = wb.addImage({ base64: drawJpeg(im, 1000, 0.78), extension: 'jpeg' });
        const sc = Math.min(1, (409 - 10) / (H * 0.75));
        gal.addImage(id2, {
          tl: { col: 1.05, row: row.number - 1 + 0.05 },
          ext: { width: Math.round(W * sc), height: Math.round(H * sc) },
          editAs: 'oneCell'
        });
        nImg++;
      }
    }
    sheet(
      'الدفعات',
      [
        ['رقم الطلب', 'o', 14],
        ['المصنع', 'f', 20],
        ['الدفعة', 'l', 16],
        ['المبلغ', 'a', 13, NF],
        ['العملة', 'c', 8],
        ['الاستحقاق', 'd', 12],
        ['الحالة', 's', 11],
        ['تاريخ التسديد', 'pd', 12],
        ['الطريقة', 'm', 13],
        ['ملاحظات', 'n', 24]
      ],
      S.payments.map(p => {
        const o = byId('orders', p.orderId);
        return {
          o: o ? o.ref : '',
          f: o ? xt(factoryName(o.factoryId)) : '',
          l: xt(p.label),
          a: +p.amount || 0,
          c: o ? o.currency : '',
          d: p.dueDate || '',
          s: p.paid ? 'مدفوعة' : 'غير مدفوعة',
          pd: p.paidDate || '',
          m: p.method || '',
          n: xt(p.note)
        };
      })
    );
    sheet(
      'الشحنات',
      [
        ['رقم الشحنة', 'r', 16],
        ['شركة الشحن', 'c', 18],
        ['الطلب', 'o', 14],
        ['التكلفة', 'cost', 13, NF],
        ['المدفوع', 'pa', 13, NF],
        ['المتبقي', 'rem', 13, NF],
        ['العملة', 'cur', 8],
        ['الحالة', 'st', 12],
        ['المغادرة', 'dd', 12],
        ['الوصول المتوقع', 'eta', 13]
      ],
      S.shipments.map(x => {
        const o = byId('orders', x.orderId),
          c = byId('carriers', x.carrierId);
        return {
          r: x.ref,
          c: c ? c.name : '',
          o: o ? o.ref : '',
          cost: +x.cost || 0,
          pa: +x.paidAmount || 0,
          rem: shipRemaining(x),
          cur: x.currency,
          st: shipName(x.status),
          dd: x.departDate || '',
          eta: x.eta || ''
        };
      })
    );
    sheet(
      'المصانع',
      [
        ['الاسم', 'n', 22],
        ['المدينة', 'c', 16],
        ['المسؤول', 'p', 16],
        ['الهاتف', 't', 18],
        ['ملاحظات', 'x', 28]
      ],
      S.factories.map(f => ({ n: xt(f.name), c: xt(f.city), p: xt(f.contact), t: f.phone || '', x: xt(f.note) }))
    );
    sheet(
      'شركات الشحن',
      [
        ['الاسم', 'n', 22],
        ['المسؤول', 'p', 16],
        ['الهاتف', 't', 18],
        ['رصيد سابق', 'b', 13, NF],
        ['العملة', 'c', 8],
        ['ملاحظات', 'x', 28]
      ],
      S.carriers.map(c => ({
        n: c.name,
        p: c.contact || '',
        t: c.phone || '',
        b: +c.openBal || 0,
        c: c.openCur || 'USD',
        x: xt(c.note)
      }))
    );
    S.carriers.forEach(c => {
      const rows = walletRows(c.id);
      if (!rows.length) return;
      sheet(
        ('كشف ' + c.name).slice(0, 31).replace(/[\\/*?:\[\]]/g, ' '),
        [
          ['التاريخ', 'd', 12],
          ['الحركة', 't', 30],
          ['التفاصيل', 's', 30],
          ['المبلغ', 'a', 14, NF],
          ['العملة', 'c', 8],
          ['الرصيد بعدها', 'b', 14, NF]
        ],
        rows.map(r => ({ d: r.d || '', t: r.t || '', s: r.sub || '', a: r.amt, c: r.cur, b: r.bal }))
      );
    });
    const its = [];
    S.orders.forEach(o =>
      (o.items || []).forEach(x =>
        its.push({ o: o.ref, n: xt(x.name), q: x.qty, p: x.price, t: r2(x.qty * x.price), c: o.currency })
      )
    );
    if (its.length)
      sheet(
        'بنود قديمة',
        [
          ['الطلب', 'o', 14],
          ['المنتج', 'n', 24],
          ['الكمية', 'q', 10],
          ['السعر', 'p', 12, NF],
          ['الإجمالي', 't', 13, NF],
          ['العملة', 'c', 8]
        ],
        its
      );
    const buf = await wb.xlsx.writeBuffer();
    const ok = await saveFile(
      'AZAWI-' + acctCode() + '-' + todayISO() + '.xlsx',
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    );
    if (ok)
      toast(nImg ? 'تم تجهيز الملف مع ' + nImg + ' صورة' + (miss ? ' (تعذر ' + miss + ')' : '') : 'تم تجهيز ملف Excel');
  } catch (e) {
    toast('تعذر إنشاء ملف Excel', 'bad');
  } finally {
    xlsBusy = false;
  }
}
async function exportJson() {
  const data = {};
  [...COLS, 'ledger', 'ctx', 'companies'].forEach(c => (data[c] = RAW[c]));
  data.files = [];
  for (const o of RAW.orders)
    for (const f of o.files || []) {
      try {
        const d = await loadFile(f.id);
        if (d) {
          const x = Object.assign({ id: f.id }, d);
          delete x.n;
          data.files.push(x);
        }
      } catch (e) {}
    }
  const okSave = await saveFile(
    'trade-system-backup-' + todayISO() + '.json',
    JSON.stringify({ app: 'trade-system', version: 2, exportedAt: new Date().toISOString(), data }, null, 1)
  );
  if (okSave) {
    try {
      await db.doc('meta/backup').set({ at: Date.now(), by: myId || '' });
    } catch (e) {}
    logAct('backup', '', 'نسخة JSON كاملة');
    toast('تم حفظ النسخة الاحتياطية');
  }
}
function restoreFile(file) {
  const r = new FileReader();
  r.onload = () => {
    let j;
    try {
      j = JSON.parse(r.result);
    } catch (e) {
      toast('الملف غير صالح', 'bad');
      return;
    }
    if (!j || j.app !== 'trade-system' || !j.data || typeof j.data !== 'object') {
      toast('هذا ليس ملف نسخة احتياطية لهذا النظام', 'bad');
      return;
    }
    const okId = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
    const clean = {};
    let skipped = 0;
    const KEYS = [...COLS, 'ledger', 'ctx', 'companies', 'files'];
    KEYS.forEach(c => {
      clean[c] = [];
      (Array.isArray(j.data[c]) ? j.data[c] : []).forEach(d => {
        if (d && typeof d === 'object' && !Array.isArray(d) && okId.test(String(d.id || ''))) clean[c].push(d);
        else skipped++;
      });
    });
    const names = {
      factories: 'مصانع',
      orders: 'طلبات',
      payments: 'دفعات',
      carriers: 'شركات شحن',
      shipments: 'شحنات',
      ledger: 'حركات حساب',
      ctx: 'حركات شركات الشحن',
      companies: 'شركات',
      files: 'مرفقات'
    };
    openModal(
      'استعادة نسخة',
      `<p>ستتم إضافة السجلات التالية. السجل المطابق بنفس المعرّف يُستبدل بما في النسخة.</p><ul class="list">${KEYS.filter(
        c => clean[c].length || COLS.includes(c)
      )
        .map(c => `<li><span>${names[c]}</span><b>${clean[c].length}</b></li>`)
        .join('')}</ul>${skipped ? `<div class="hint bad">سيتم تجاهل ${skipped} سجل غير صالح.</div>` : ''}`,
      {
        submitText: 'استعادة',
        onSubmit: async () => {
          try {
            let n = 0;
            for (const c of KEYS)
              for (const d of clean[c]) {
                if (c === 'files') {
                  if (d.data) await writeFileDoc(d.id, d);
                } else await put(c, d, { quiet: true });
                n++;
              }
            logAct('restore', '', 'استعادة ' + n + ' سجل من نسخة احتياطية');
            closeModal(true);
            toast('تمت الاستعادة');
          } catch (e) {}
        }
      }
    );
  };
  r.readAsText(file);
}
async function demoLoad() {
  const t = todayISO(),
    mk = (col, o) => {
      const id = newId(col);
      return put(col, Object.assign({ id, demo: true }, o), { quiet: true }).then(() => id);
    };
  try {
    const f1 = await mk('factories', { name: 'مصنع تجريبي (أ)', city: '—', note: 'بيانات تجريبية' });
    const f2 = await mk('factories', { name: 'مصنع تجريبي (ب)', city: '—', note: 'بيانات تجريبية' });
    const c1 = await mk('carriers', { name: 'شركة شحن تجريبية', mode: 'sea', note: 'بيانات تجريبية' });
    const o1 = await mk('orders', {
      factoryId: f1,
      ref: 'تجريبي-001',
      orderDate: addDays(t, -20),
      prepDate: addDays(t, -3),
      stage: 'production',
      currency: 'USD',
      items: [
        { name: 'منتج تجريبي 1', qty: 500, price: 4.5 },
        { name: 'منتج تجريبي 2', qty: 200, price: 12 }
      ]
    });
    const o2 = await mk('orders', {
      factoryId: f2,
      ref: 'تجريبي-002',
      orderDate: addDays(t, -10),
      prepDate: addDays(t, 5),
      stage: 'production',
      currency: 'CNY',
      items: [{ name: 'منتج تجريبي 3', qty: 1000, price: 8 }]
    });
    const o3 = await mk('orders', {
      factoryId: f1,
      ref: 'تجريبي-003',
      orderDate: addDays(t, -40),
      prepDate: addDays(t, -15),
      stage: 'ready',
      currency: 'USD',
      items: [{ name: 'منتج تجريبي 4', qty: 300, price: 9 }]
    });
    await mk('payments', {
      orderId: o1,
      label: 'عربون',
      amount: 1500,
      dueDate: addDays(t, -18),
      paid: true,
      paidDate: addDays(t, -18),
      method: 'تحويل بنكي'
    });
    await mk('payments', {
      orderId: o1,
      label: 'الرصيد',
      amount: 1650,
      dueDate: addDays(t, -1),
      paid: false,
      method: 'تحويل بنكي'
    });
    await mk('payments', {
      orderId: o2,
      label: 'عربون',
      amount: 2400,
      dueDate: addDays(t, 3),
      paid: false,
      method: 'تحويل بنكي'
    });
    await mk('payments', {
      orderId: o3,
      label: 'دفعة كاملة',
      amount: 2700,
      dueDate: addDays(t, -30),
      paid: true,
      paidDate: addDays(t, -30),
      method: 'تحويل بنكي'
    });
    await mk('shipments', {
      ref: 'شحنة-تجريبية-1',
      carrierId: c1,
      orderId: o3,
      cost: 900,
      currency: 'USD',
      paidAmount: 300,
      status: 'transit',
      departDate: addDays(t, -12),
      eta: addDays(t, 9)
    });
    logAct('demo', '', 'تحميل بيانات تجريبية');
    toast('تم تحميل البيانات التجريبية');
  } catch (e) {}
}
async function demoClear() {
  try {
    for (const c of COLS) for (const d of S[c].filter(x => x.demo)) await remove(c, d.id, { quiet: true });
    logAct('demo', '', 'حذف البيانات التجريبية');
    toast('تم حذف البيانات التجريبية');
  } catch (e) {}
}
