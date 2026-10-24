/* Helpers: DOM, formatting, money, dates, icons */
const $ = s => document.querySelector(s);
const esc = s =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const pad = n => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
const diffDays = iso => Math.round((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 864e5);
const fmtD = iso => (iso ? iso.split('-').reverse().join('/') : '—');
const num = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const CUR = { USD: '$', CNY: '¥' };
const money = (n, c) => '<bdi dir="ltr">' + (CUR[c] || c || '$') + num(n) + '</bdi>';
const addTo = (o, c, v) => {
  c = c || 'USD';
  o[c] = (o[c] || 0) + v;
};
const multi = (o, stack) => {
  const k = Object.keys(o).filter(c => Math.abs(o[c]) > 0.001);
  if (!k.length) return money(0, 'CNY');
  return k
    .map(c => (stack ? '<span class="stk">' + money(o[c], c) + '</span>' : money(o[c], c)))
    .join(stack ? '' : ' · ');
};
const plural = n => (n === 1 ? 'يوم' : n === 2 ? 'يومان' : n <= 10 ? n + ' أيام' : n + ' يوماً');
const dueText = iso => {
  if (!iso) return 'بدون موعد';
  const d = diffDays(iso);
  return d < 0 ? 'متأخر ' + plural(-d) : d === 0 ? 'اليوم' : d === 1 ? 'غداً' : 'بعد ' + plural(d);
};
const dueKind = iso => {
  if (!iso) return 'mute';
  const d = diffDays(iso);
  return d < 0 ? 'bad' : d <= 7 ? 'warn' : 'info';
};
const pill = (k, t) => `<span class="pill ${k}">${esc(t)}</span>`;
const ICONS = {
  menu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  ship: '<path d="M3 17l2 3h14l2-3-9-3z"/><path d="M12 14V4l5 4"/>',
  factory: '<path d="M3 21V10l6 4v-4l6 4V6h6v15z"/>',
  truck: '<path d="M2 6h11v10H2zM13 10h5l3 3v3h-8z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  building: '<path d="M4 21V5l8-2v18M12 8l8 2v11M8 8h1M8 12h1M8 16h1M16 13h1M16 17h1M3 21h18"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-5.5 6-5.5s6 2.1 6 5.5M16 5.5a3 3 0 0 1 0 5.8M18 14.8c1.9.6 3 2.3 3 5.2"/>',
  out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
};
const ico = (n, s = 18) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
let toastT;
function toast(msg, kind) {
  const old = $('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3200);
}
// read a typed amount: accepts 1,000 / ١٬٠٠٠ / ۱۰۰۰ / full-width Chinese digits １０００ and ٫ or ． as decimal point
const num2 = v => {
  const n = parseFloat(
    String(v || '')
      .replace(/[\uFF10-\uFF19]/g, d => d.charCodeAt(0) - 0xff10)
      .replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x660)
      .replace(/[\u06F0-\u06F9]/g, d => d.charCodeAt(0) - 0x6f0)
      .replace(/[\u066B\uFF0E]/g, '.')
      .replace(/[,\s\u066C\uFF0C]/g, '')
  );
  return isFinite(n) ? n : 0;
};
