/* Attachments: chunked storage, thumbnails, viewer, sheet preview */
let PEND = [],
  ATT_E = [];
const FILE_MAX = 8 * 1024 * 1024,
  CHUNK = 180000;
const fmtSize = n =>
  n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB';
const isImg = t => /^image\//.test(t || ''),
  isSheet = n => /\.(xlsx|xls|csv)$/i.test(n || '');
const readDataURL = f =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('read'));
    r.readAsDataURL(f);
  });
const loadImg = u =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('img'));
    i.src = u;
  });
function drawJpeg(img, max, q) {
  const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * sc));
  c.height = Math.max(1, Math.round(img.naturalHeight * sc));
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
async function prepFile(file) {
  if (isImg(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)) {
    const url = await readDataURL(file);
    let img;
    try {
      img = await loadImg(url);
    } catch (e) {
      if (file.size > FILE_MAX) throw new Error('big');
      return { name: file.name, type: file.type || 'image/*', size: file.size, data: url, thumb: '' };
    }
    const data = drawJpeg(img, 1600, 0.82),
      thumb = drawJpeg(img, 260, 0.6);
    return {
      name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
      type: 'image/jpeg',
      size: Math.round(data.length * 0.75),
      data,
      thumb
    };
  }
  if (file.size > FILE_MAX) throw new Error('big');
  let type = file.type;
  if (!type)
    type = /\.csv$/i.test(file.name)
      ? 'text/csv'
      : /\.xlsx$/i.test(file.name)
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : /\.xls$/i.test(file.name)
          ? 'application/vnd.ms-excel'
          : /\.pdf$/i.test(file.name)
            ? 'application/pdf'
            : 'application/octet-stream';
  return { name: file.name, type, size: file.size, data: await readDataURL(file), thumb: '' };
}
async function writeFileDoc(fid, d) {
  const parts = [];
  for (let i = 0; i < d.data.length; i += CHUNK) parts.push(d.data.slice(i, i + CHUNK));
  for (let k = 0; k < parts.length; k++)
    await db
      .collection('fchunks')
      .doc(fid + '_' + k)
      .set({ fid, k, data: parts[k] });
  await db
    .collection('files')
    .doc(fid)
    .set({
      orderId: d.orderId || '',
      companyId: d.companyId || ACTIVE || DEFAULT_CO,
      name: d.name,
      type: d.type,
      size: d.size || 0,
      n: parts.length,
      at: d.at || Date.now()
    });
}
async function storeFile(oid, a) {
  const fid = newId('files');
  const o = byId('orders', oid);
  await writeFileDoc(fid, {
    orderId: oid,
    companyId: (o && o.companyId) || ACTIVE,
    name: a.name,
    type: a.type,
    size: a.size,
    data: a.data
  });
  return { id: fid, name: a.name, type: a.type, size: a.size, thumb: a.thumb || '' };
}
async function loadFile(fid) {
  const sn = await db.collection('files').doc(fid).get();
  if (!sn.exists) return null;
  const d = sn.data();
  if (d.data) return d;
  const cs = await Promise.all(
    Array.from({ length: d.n || 0 }, (_, k) =>
      db
        .collection('fchunks')
        .doc(fid + '_' + k)
        .get()
    )
  );
  if (cs.some(c => !c.exists)) return null;
  return Object.assign({}, d, { data: cs.map(c => c.data().data).join('') });
}
async function dropFile(fid) {
  let n = 0;
  try {
    const sn = await db.collection('files').doc(fid).get();
    if (sn.exists) n = sn.data().n || 0;
  } catch (e) {}
  for (let k = 0; k < n; k++)
    try {
      await db
        .collection('fchunks')
        .doc(fid + '_' + k)
        .delete();
    } catch (e) {}
  await db.collection('files').doc(fid).delete();
}
async function queueAttach(files, quiet) {
  for (const f of files) {
    try {
      PEND.push(await prepFile(f));
    } catch (e) {
      if (!quiet)
        toast(e && e.message === 'big' ? '«' + f.name + '» أكبر من 8 MB' : 'تعذر قراءة «' + f.name + '»', 'bad');
    }
  }
  renderAtt();
}
function attIcon(f) {
  return isImg(f.type) && f.thumb
    ? `<img class="athumb" src="${f.thumb}" alt="">`
    : `<span class="aicon">${isSheet(f.name) ? 'XLS' : /pdf/i.test(f.type) ? 'PDF' : isImg(f.type) ? 'IMG' : 'FILE'}</span>`;
}
function renderAtt() {
  const el = $('#attList');
  if (!el) return;
  const li = (f, extra) =>
    `<li class="arow">${attIcon(f)}<div class="t"><b>${esc(f.name)}</b><small>${fmtSize(f.size)}</small></div><div class="r">${extra || ''}</div></li>`;
  el.innerHTML =
    ATT_E.map(f => li(f, pill('mute', 'محفوظ'))).join('') +
    PEND.map((f, i) =>
      li(
        f,
        pill('warn', 'جديد') +
          `<button type="button" class="icon" data-act="rm-pend" data-i="${i}" aria-label="إزالة">${ico('x', 16)}</button>`
      )
    ).join('');
}
async function attachToOrder(oid, files) {
  if (!files.length) return;
  toast('جارٍ رفع ' + (files.length > 1 ? files.length + ' ملفات' : 'الملف') + '…');
  const metas = [];
  for (const f of files) {
    let a;
    try {
      a = await prepFile(f);
    } catch (e) {
      toast(e && e.message === 'big' ? '«' + f.name + '» أكبر من 8 MB' : 'تعذر قراءة «' + f.name + '»', 'bad');
      continue;
    }
    try {
      metas.push(await storeFile(oid, a));
    } catch (e) {
      toast('تعذر حفظ «' + f.name + '»', 'bad');
    }
  }
  const o = byId('orders', oid);
  if (!o || !metas.length) return;
  try {
    await put('orders', Object.assign({}, o, { files: (o.files || []).concat(metas) }), { quiet: true });
    logAct('edit', 'orders', 'مرفق للطلب ' + o.ref);
    toast(metas.length > 1 ? 'تم إرفاق ' + metas.length + ' ملفات' : 'تم إرفاق الملف');
  } catch (e) {}
}
function attSection(o) {
  const fs = o.files || [],
    imgs = fs.filter(f => isImg(f.type)),
    oth = fs.filter(f => !isImg(f.type));
  return `<div><h3 style="margin-bottom:8px">المرفقات <label class="btn ghost sm filebtn">${ico('plus', 14)} إضافة<input type="file" class="vh" data-attach-order="${o.id}" accept="image/*,.xlsx,.xls,.csv,.pdf" multiple></label></h3>
  ${imgs.length ? `<div class="thumbs">${imgs.map(f => `<button type="button" class="thumb" data-act="view-file" data-id="${f.id}" data-order="${o.id}" aria-label="${esc(f.name)}">${f.thumb ? `<img src="${f.thumb}" alt="">` : `<span class="aicon">IMG</span>`}</button>`).join('')}</div>` : ''}
  ${oth.length ? `<ul class="list">${oth.map(f => `<li class="arow">${attIcon(f)}<div class="t"><b>${esc(f.name)}</b><small>${fmtSize(f.size)}</small></div><div class="r">${isSheet(f.name) ? `<button class="btn ghost sm" type="button" data-act="view-file" data-id="${f.id}" data-order="${o.id}">عرض</button>` : ''}<button class="icon" type="button" data-act="dl-file" data-id="${f.id}" aria-label="تنزيل">${ico('down', 16)}</button>${ADMIN ? `<button class="icon" type="button" data-act="del-file" data-id="${f.id}" data-order="${o.id}" aria-label="حذف">${ico('trash', 16)}</button>` : ''}</div></li>`).join('')}</ul>` : ''}
  ${!fs.length ? '<p style="color:var(--mute);margin:0">لا توجد مرفقات. أضف صورة الفاتورة أو ملف Excel.</p>' : ''}</div>`;
}
function dataUrlToBlob(u) {
  const i = u.indexOf(','),
    m = /data:([^;,]+)/.exec(u.slice(0, i));
  const bin = atob(u.slice(i + 1));
  const a = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
  return new Blob([a], { type: m ? m[1] : 'application/octet-stream' });
}
async function dlFile(fid) {
  const d = await loadFile(fid).catch(() => null);
  if (!d) {
    toast('تعذر فتح المرفق', 'bad');
    return;
  }
  await saveFile(d.name, dataUrlToBlob(d.data));
}
/* popup viewer (sits above the order, closing it returns to the order) */
const LB = { fid: null, oid: null };
function openLb(title, html, fid, oid) {
  LB.fid = fid;
  LB.oid = oid;
  const lb = $('#lb');
  $('#lbTitle').textContent = title;
  $('#lbBody').innerHTML = html;
  $('#lbDel').hidden = !(ADMIN && oid);
  lb.hidden = false;
  lb.classList.remove('in');
  void lb.offsetWidth;
  lb.classList.add('in');
}
function closeLb() {
  const lb = $('#lb');
  if (lb) {
    lb.hidden = true;
    $('#lbBody').innerHTML = '';
  }
  LB.fid = null;
}
async function viewFile(fid, oid) {
  const o = byId('orders', oid),
    meta = o && (o.files || []).find(f => f.id === fid);
  if (meta && !isImg(meta.type) && !isSheet(meta.name)) {
    dlFile(fid);
    return;
  }
  openLb(
    meta ? meta.name : 'مرفق',
    meta && meta.thumb ? `<img class="lbimg blur" src="${meta.thumb}" alt="">` : '<div class="skel"></div>',
    fid,
    oid
  );
  const d = await loadFile(fid).catch(() => null);
  if (LB.fid !== fid) return;
  if (!d) {
    $('#lbBody').innerHTML = '<p>تعذر فتح المرفق.</p>';
    return;
  }
  if (isImg(d.type)) {
    $('#lbBody').innerHTML = `<img class="lbimg" src="${d.data}" alt="${esc(d.name)}">`;
    if (meta && !meta.thumb)
      try {
        const im = await loadImg(d.data),
          th = drawJpeg(im, 260, 0.6);
        const oo = byId('orders', oid);
        if (oo)
          await put(
            'orders',
            Object.assign({}, oo, {
              files: (oo.files || []).map(f => (f.id === fid ? Object.assign({}, f, { thumb: th }) : f))
            }),
            { quiet: true }
          );
      } catch (e) {}
    return;
  }
  if (isSheet(d.name)) {
    $('#lbBody').innerHTML = sheetHTML(d);
    $('#lbBody')
      .querySelectorAll('[data-sheet]')
      .forEach(b =>
        b.addEventListener('click', () => {
          $('#lbBody').innerHTML = sheetHTML(d, +b.dataset.sheet);
        })
      );
    return;
  }
}
function sheetHTML(d, idx) {
  if (!window.XLSX) return '<p>مكتبة Excel غير محمّلة. نزّل الملف لفتحه.</p>';
  try {
    const bin = dataUrlToBlob(d.data);
    const raw = atob(d.data.slice(d.data.indexOf(',') + 1)),
      u8 = new Uint8Array(raw.length);
    for (let k = 0; k < raw.length; k++) u8[k] = raw.charCodeAt(k);
    const wb = /\.csv$/i.test(d.name)
      ? XLSX.read(new TextDecoder('utf-8').decode(u8), { type: 'string' })
      : XLSX.read(u8, { type: 'array' });
    idx = idx || 0;
    const ws = wb.Sheets[wb.SheetNames[idx]];
    const rows = XLSX.utils
      .sheet_to_json(ws, { header: 1, defval: '', raw: false })
      .filter(r => r.some(c => String(c).trim() !== ''));
    if (!rows.length) return '<p>الورقة فارغة.</p>';
    const w = Math.max(...rows.slice(0, 300).map(r => r.length)),
      head = rows[0],
      body = rows.slice(1, 300);
    const tabs =
      wb.SheetNames.length > 1
        ? `<div class="chips" style="margin-bottom:10px">${wb.SheetNames.map((n, i) => `<button type="button" class="chip${i === idx ? ' on' : ''}" data-sheet="${i}">${esc(n)}</button>`).join('')}</div>`
        : '';
    const cell = v => {
      const t = String(v);
      return `<td${/^-?[\d,.]+%?$/.test(t.trim()) ? ' class="n"' : ''}>${esc(t)}</td>`;
    };
    return (
      tabs +
      `<div class="sheetwrap"><table class="sheet"><thead><tr><th>#</th>${Array.from({ length: w }, (_, i) => `<th>${esc(head[i] == null ? '' : head[i])}</th>`).join('')}</tr></thead><tbody>${body.map((r, ri) => `<tr><td class="rn">${ri + 1}</td>${Array.from({ length: w }, (_, i) => cell(r[i] == null ? '' : r[i])).join('')}</tr>`).join('')}</tbody></table></div><p class="sheetnote">${body.length} صف${rows.length > 300 ? ' (أول 300 فقط)' : ''}</p>`
    );
  } catch (e) {
    return '<p>تعذر قراءة الملف. نزّله لفتحه في Excel.</p>';
  }
}
function delFileAsk(fid, oid) {
  const o = byId('orders', oid),
    f = o && (o.files || []).find(x => x.id === fid);
  if (!f) return;
  closeLb();
  openModal(
    'تأكيد الحذف',
    `<p>سيتم حذف المرفق <b>${esc(f.name)}</b> نهائياً.</p><div class="mf"><button type="button" class="btn ghost" data-act="close">تراجع</button><button type="button" class="btn danger" data-act="del-file-ok" data-id="${fid}" data-order="${oid}">حذف</button></div>`,
    { back: () => openOrder(oid) }
  );
}
async function delFileOk(fid, oid) {
  const o = byId('orders', oid);
  if (!o) return;
  try {
    await dropFile(fid);
    await put('orders', Object.assign({}, o, { files: (o.files || []).filter(x => x.id !== fid) }), { quiet: true });
    logAct('delete', 'orders', 'مرفق من الطلب ' + o.ref);
    closeModal();
    toast('تم حذف المرفق');
  } catch (e) {
    toast('تعذر الحذف', 'bad');
  }
}
