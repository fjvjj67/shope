# ARCHITECTURE — how the code is organised

Plain HTML + CSS + JavaScript. **No build step**: edit a file, run `python3 tools/stamp.py`, push.
GitHub Pages serves the repo as-is; Supabase is the database.

## Files

```
index.html              page shell + the list of css/js files (in load order)
css/
  base.css              layout, components, phone layout (bottom tabs, bottom sheets)
  z-style.css           the "Z" look: warm hero cards, dashboard grid, motion
  light.css             clean-white theme (html[data-ui="light"])
js/                     classic scripts sharing globals — ORDER MATTERS (see index.html)
  config.js             Supabase URL + public anon key
  core.js               helpers: $, esc, money, num, num2 (reads any digits), dates, icons, toast
  data.js               live collections (S / RAW), company scoping, put() / remove(), activity log
  files.js              attachments: chunked storage in `fchunks`, thumbnails, viewer, Excel preview
  wallet.js             shipping-company wallet: send money, pay factory, fees, statement, pending transfers
  accounts.js           accounts (Guangzhou `main` / Yiwu `yiwu`), switching, balances
  logic.js              business rules: order remaining, payment status, timing
  forms.js              modal + forms: order, payment, shipment, factory, carrier
  views.js              pages: dashboard, lists, order detail, backup page
  export.js             Excel export, JSON backup/restore, demo data
  shell.js              navigation, render loop, all click/keyboard actions (data-act="…")
  users.js              users & roles page (admin)
  db.js                 Supabase adapter: paging, realtime, refresh on wake/online
  i18n-zh-dict.js       Chinese wording (ZH_DICT words, ZH_PATTERNS whole sentences)  ← edit wording here
  i18n.js               language engine: Chinese screen + translation of typed text
  auth.js               PIN login, remember device, profile/role/company, startApp()
  main.js               starts the app (must be last)
lib/  fonts/            local copies (works in China without Google/CDNs)
supabase/               SQL in the order it was applied (01…10) + edge functions
  functions/translate   Chinese⇄Arabic translation with a shared cache table
tests/                  browser tests with a fake Supabase (tests/mock_supabase.js)
tools/stamp.py          cache-busting ?v= stamp for css/js
```

## Data model (Supabase)
* One table **`docs(col, id, data jsonb)`**. `col` is the collection:
  `factories, orders, payments, carriers, shipments, ledger, ctx` (wallet moves), `companies`,
  `activity`, `files` + `fchunks` (attachments), `meta`.
* Every business row has `data.companyId` (`main` = كوانزو, `yiwu` = ايو). Missing = `main`.
* **`profiles(user_id, role, company, lang)`**: role `admin | staff | pending`; staff is locked to `company` and sees `lang`.
* **`docs_history`**: every insert/update/delete (trigger `docs_audit`) → anything can be recovered.
* **`translations`**: cache of the translate function (server-only).
* **Security = Row Level Security** (`supabase/08_staff_company.sql`):
  admin everything; staff read/insert/update only their company, never `meta`; delete = admin only.
  The page hides buttons too, but the database is the real lock.

## Login
`pin-login` edge function: PIN → signs into `admin@azawi.app` or `staff@azawi.app` (the PIN is that account's password).
To change a PIN: Supabase → Authentication → Users → the account → change password.
The session is kept on the device ("تذكّرني"); role/company/lang are cached and re-checked in the background.

## How rendering works
`data.js` subscribes to every collection → `S[col]` (current account) / `RAW[col]` (all).
Any change → `schedule()` → `refresh()`/`render()` redraws the current page from `S`.
Buttons carry `data-act="…"`; `shell.js` has one switch handling them all.
Permissions in the page: `ADMIN` (can delete), `CANEDIT` (admin or staff), `LOCK_CO` (staff's company).
Body classes: `ro` (read-only), `nodel` (no delete buttons), `lockco` (no account create/rename).

## Languages (js/i18n.js)
* Chinese screen: a MutationObserver rewrites Arabic interface text using `ZH_PATTERNS` (whole sentences) then `ZH_DICT` (longest phrase first, whole words only). New text → add it to `i18n-zh-dict.js`.
* Typed text: runs of the *other* script are sent to `functions/v1/translate`, cached in the browser (`azawi-ct-ar|zh`) and on the server. The database keeps the original.

## Making a change
1. Edit the file (search for the Arabic text you see on screen, or the `data-act` name of the button).
2. `python3 tools/stamp.py` (so phones don't keep the old file).
3. Run the tests: `PW=… CHROMIUM=… tests/run-all.sh` (see the header of `tests/run-all.sh`).
4. Push to the branch GitHub Pages serves (`claude/eloquent-davinci-xkw8fn`).
5. Database change → add a new numbered file in `supabase/` and run it in Supabase SQL Editor.

## Known limits / next steps
* Attachments are stored inside the database (`fchunks`). The free plan has 500 MB; with many photos,
  move them to Supabase Storage.
* The free translation provider is unofficial; set the secret `GOOGLE_TRANSLATE_KEY` on the translate
  function to use the official Google API (500k characters/month free).
* GitHub Pages / Supabase can be slow or blocked in mainland China without a VPN.
