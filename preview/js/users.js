/* Users and roles page (admin) */
const ROLE_TXT = { pending: 'موقوف', staff: 'موظف', admin: 'مدير' };
function usersView() {
  const rows = Object.values(PROFILES).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  return `<div class="card"><h3>المستخدمون والصلاحيات</h3><p style="color:var(--mute);margin:6px 0 12px">المدير: كل الصلاحيات. الموظف: يسوي كلشي (طلبات، شحنات، فلوس، مصانع) بس ما يكدر يحذف أي شي. موقوف: ما يشوف أي شي. الدخول برمز المدير أو رمز الموظف.</p>
  <table class="tbl"><thead><tr><th>المستخدم</th><th>الدور</th></tr></thead><tbody>${rows
    .map(
      p =>
        `<tr><td data-label="المستخدم">${esc(p.name || '—')}${p.user_id === myId ? ' ' + pill('mute', 'أنت') : ''}</td><td data-label="الدور"><select class="rolesel" data-uid="${esc(p.user_id)}" aria-label="الدور" ${p.user_id === myId ? 'disabled' : ''}>${Object.entries(
          ROLE_TXT
        )
          .map(([k, t]) => `<option value="${k}"${p.role === k ? ' selected' : ''}>${t}</option>`)
          .join('')}</select></td></tr>`
    )
    .join('')}</tbody></table></div>${moneyEditCard()}`;
}
/* admin decides, per account, whether the assistant may edit transfers and fees */
function moneyEditCard() {
  return `<div class="card" style="margin-top:14px"><h3>تعديل الحسابات</h3><p style="color:var(--mute);margin:6px 0 12px">المدير يكدر يعدّل التحويلات والمصاريف دائماً. هنا تختار إذا مساعدك يكدر يعدّلها بكل حساب. الحذف يبقى للمدير بس، وكل تعديل ينحفظ بالسجل.</p>${S.companies
    .map(
      c =>
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0"><span>${esc(c.name)}: <b>${c.staffMoneyEdit ? 'مساعدك يكدر يعدّل' : 'مساعدك ما يكدر يعدّل'}</b></span><button class="btn ${c.staffMoneyEdit ? 'ghost ' : ''}sm" data-act="money-edit-sw" data-co="${c.id}" aria-pressed="${!!c.staffMoneyEdit}">${c.staffMoneyEdit ? 'اقفل التعديل' : 'اسمح بالتعديل'}</button></div>`
    )
    .join('')}</div>`;
}
async function loadProfiles() {
  try {
    const { data, error } = await SB.from('profiles').select('*');
    if (error) throw error;
    PROFILES = {};
    data.forEach(p => (PROFILES[p.user_id] = p));
    if (cur === 'users' && !document.querySelector('select.rolesel:focus')) {
      const v = $('#view');
      if (v) v.innerHTML = usersView();
    }
  } catch (e) {}
}
document.addEventListener('change', async e => {
  const t = e.target;
  if (!t.matches || !t.matches('select.rolesel')) return;
  if (!ADMIN) {
    toast('للمدير فقط', 'bad');
    return;
  }
  const uid = t.dataset.uid,
    role = t.value;
  const { error } = await SB.from('profiles').update({ role }).eq('user_id', uid);
  if (error) {
    toast('تعذر تغيير الصلاحية', 'bad');
    loadProfiles();
    return;
  }
  if (PROFILES[uid]) PROFILES[uid].role = role;
  logAct('edit', '', 'صلاحية ' + (PROFILES[uid] ? PROFILES[uid].name || '' : '') + ' ← ' + ROLE_TXT[role]);
  toast('تم تحديث الصلاحية');
});
