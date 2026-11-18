/* Login by PIN, remember device, profile/role, boot */
function showAuth(mode, msg) {
  const a = $('#auth');
  a.hidden = false;
  const head = '<h1>الطلبات والشحن</h1>';
  if (mode === 'setup') {
    a.innerHTML = `<div class="box">${head}<p>لم يتم ربط الموقع بقاعدة البيانات بعد. افتح ملف config.js وضع عنوان المشروع والمفتاح العام (انظر ملف التعليمات).</p></div>`;
    return;
  }
  if (mode === 'pending') {
    a.innerHTML = `<div class="box">${head}<p>تم تسجيل دخولك، لكن حسابك لم يُفعَّل بعد. اطلب من المدير تفعيله ثم أعد تحميل الصفحة.</p><button class="btn" id="authOut" type="button">تسجيل الخروج</button></div>`;
    $('#authOut').onclick = logout;
    return;
  }
  a.innerHTML = `<form class="box" id="authForm" novalidate>${head}<p>اكتب رمز الدخول</p>
    <label>الرمز<input id="aPin" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" dir="ltr" required></label>
    <label class="rem"><input id="aRem" type="checkbox" checked>تذكّرني على هذا الجهاز</label>
    <p class="err" id="aErr" role="alert">${esc(msg || '')}</p>
    <button class="btn" id="aGo" type="submit">دخول</button></form>`;
  setTimeout(() => {
    const i = $('#aPin');
    i && i.focus();
  }, 50);
  try {
    fetch(window.APP_CONFIG.url + '/functions/v1/pin-login', { method: 'OPTIONS' }).catch(() => {});
  } catch (e) {}
  $('#authForm').onsubmit = async ev => {
    ev.preventDefault();
    const pin = $('#aPin')
      .value.trim()
      .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660)
      .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6f0);
    if (!pin) {
      $('#aErr').textContent = 'اكتب الرمز';
      return;
    }
    const b = $('#aGo');
    b.disabled = true;
    b.textContent = 'جارٍ الدخول…';
    try {
      const cfg = window.APP_CONFIG;
      const r = await fetch(cfg.url + '/functions/v1/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
        body: JSON.stringify({ pin })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.access_token) {
        setRemember($('#aRem').checked);
        const { data, error } = await SB.auth.setSession({
          access_token: d.access_token,
          refresh_token: d.refresh_token
        });
        if (error) throw error;
        enter(data.user);
        return;
      }
      $('#aErr').textContent =
        r.status === 429 ? 'محاولات كثيرة. جرّب بعد ' + (d.retry_min || 15) + ' دقيقة' : 'الرمز غير صحيح';
    } catch (e) {
      $('#aErr').textContent = 'تعذر الاتصال. تحقق من الإنترنت';
    }
    b.disabled = false;
    b.textContent = 'دخول';
  };
}
const AUTH_KEY = 'azawi-shope-auth',
  REM_KEY = 'azawi-shope-rem',
  PROF_KEY = 'azawi-shope-prof';
function remembered() {
  try {
    return localStorage.getItem(REM_KEY) !== '0';
  } catch (e) {
    return true;
  }
}
function setRemember(on) {
  try {
    localStorage.setItem(REM_KEY, on ? '1' : '0');
    if (!on) localStorage.removeItem(AUTH_KEY);
    else sessionStorage.removeItem(AUTH_KEY);
  } catch (e) {}
}
const authStore = {
  getItem: k => {
    try {
      return (remembered() ? localStorage : sessionStorage).getItem(k);
    } catch (e) {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      (remembered() ? localStorage : sessionStorage).setItem(k, v);
    } catch (e) {}
  },
  removeItem: k => {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch (e) {}
  }
};
function cachedProf(uid) {
  try {
    const p = JSON.parse(localStorage.getItem(PROF_KEY) || 'null');
    return p && p.uid === uid ? p : null;
  } catch (e) {
    return null;
  }
}
function startApp(user, role, co, lang) {
  ME = { id: user.id, email: '', role };
  LOCK_CO = role === 'staff' && co ? co : null;
  document.body.classList.toggle('lockco', !!LOCK_CO);
  I18N.start(lang === 'zh' ? 'zh' : 'ar'); // screen language + translation of typed text
  $('#auth').hidden = true;
  SBDB = makeDb(SB);
  init();
}
async function fetchMyProf(user) {
  const [mine, all] = await Promise.all([
    SB.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    SB.from('profiles').select('*')
  ]);
  PROFILES = {};
  (all.data || []).forEach(p => (PROFILES[p.user_id] = p));
  if (mine.error) throw mine.error;
  return mine.data;
}
async function enter(user) {
  const c = cachedProf(user.id);
  if (c && (c.role === 'admin' || c.role === 'staff')) {
    startApp(user, c.role, c.co, c.lang);
    fetchMyProf(user)
      .then(prof => {
        const r = prof && prof.role;
        if (!r || r === 'pending') {
          try {
            localStorage.removeItem(PROF_KEY);
          } catch (e) {}
          logout();
          return;
        }
        if (r !== c.role || (prof.company || null) !== (c.co || null) || (prof.lang || null) !== (c.lang || null)) {
          try {
            localStorage.setItem(
              PROF_KEY,
              JSON.stringify({ uid: user.id, role: r, co: prof.company || null, lang: prof.lang || null })
            );
          } catch (e) {}
          location.reload();
          return;
        }
        if (false) {
          try {
            localStorage.setItem(PROF_KEY, JSON.stringify({ uid: user.id, role: r }));
          } catch (e) {}
          location.reload();
        }
      })
      .catch(() => {});
    return;
  }
  let prof = null;
  try {
    prof = await fetchMyProf(user);
  } catch (e) {
    showAuth('login', 'تعذر الاتصال. تحقق من الإنترنت');
    return;
  }
  if (!prof || prof.role === 'pending' || !prof.role) {
    showAuth('pending');
    return;
  }
  try {
    localStorage.setItem(
      PROF_KEY,
      JSON.stringify({ uid: user.id, role: prof.role, co: prof.company || null, lang: prof.lang || null })
    );
  } catch (e) {}
  startApp(user, prof.role, prof.company, prof.lang);
}
async function logout() {
  try {
    localStorage.removeItem(PROF_KEY);
  } catch (e) {}
  try {
    await SB.auth.signOut();
  } catch (e) {}
  authStore.removeItem(AUTH_KEY);
  location.reload();
}
async function boot() {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase) {
    showAuth('setup');
    return;
  }
  SB = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: AUTH_KEY,
      storage: authStore
    }
  });
  try {
    const old = 'sb-' + new URL(cfg.url).hostname.split('.')[0] + '-auth-token';
    if (!localStorage.getItem(AUTH_KEY) && localStorage.getItem(old)) {
      localStorage.setItem(AUTH_KEY, localStorage.getItem(old));
      localStorage.removeItem(old);
    }
  } catch (e) {}
  let sess = null;
  try {
    const { data } = await SB.auth.getSession();
    sess = data && data.session;
  } catch (e) {}
  if (!sess) {
    showAuth('login');
    return;
  }
  enter(sess.user);
}
