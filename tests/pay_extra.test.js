// Paying a factory through a shipping company with MORE than the order's remaining (e.g. transport paid too):
// one entry → payment = exactly the remaining, the extra = a fee (نقل من المصنع…) on the same order and company.
const ROOT=require('path').resolve(__dirname,'..'),OS=require('os');
const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');
const html=fs.readFileSync(ROOT+'/index.html','utf8'),mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
async function page(b,role){const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u==='https://app.test/')return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
  if(u.endsWith('/lib/supabase.min.js'))return r.fulfill({contentType:'text/javascript',body:'window.__ROLE="'+role+'";'+mock});
  if(u.includes('/functions/v1/pin-login'))return r.fulfill({contentType:'application/json',body:JSON.stringify({access_token:'tok',refresh_token:'r'})});
  if(u.startsWith('https://app.test/')){const f=ROOT+'/'+u.replace('https://app.test/','').split('?')[0];return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'text/javascript':'font/woff2'}):r.fulfill({status:404,body:''})}
  return r.abort()});
 await p.goto('https://app.test/');await p.waitForSelector('#aPin');await p.fill('#aPin','1234');await p.click('#aGo');
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));return {p,ctx,errs}}
const L=s=>console.log('step',s);const save=p=>p.click('.modal .mf .btn:not(.ghost)');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 let {p,ctx,errs}=await page(b,'admin');
 // money in + order of 10,000 ¥
 await p.evaluate(()=>{go('home');document.querySelector('#view [data-act=w-in]').click()});await p.waitForSelector('#mform',{state:'attached'});await p.fill('#f_wAmt','70000');await save(p);
 await p.waitForFunction(()=>S.ctx.length===1);
 await p.waitForTimeout(400);await p.evaluate(()=>{closeModal(true);go('orders');orderForm(null)});await p.waitForSelector('#nfBox',{timeout:5000});
 await p.fill('#f_newFactory','مصنع');await p.click('[data-act=ref-mode]');await p.fill('#f_ref','rasool no.78');await p.fill('#f_total','10000');await save(p);
 await p.waitForFunction(()=>S.orders.length===1);const cid=await p.evaluate(()=>S.carriers[0].id);
 // partial 3,000 → normal, picker hidden
 await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);walletForm('pay',S.orders[0].id)});await p.waitForSelector('#mform',{state:'attached'});await p.fill('#f_wAmt','3000');
 ok(await p.evaluate(()=>document.querySelector('#wXtra').hidden),'no extra picker when amount ≤ remaining');
 await save(p);await p.waitForFunction(()=>S.payments.length===1);
 // 8,000 while remaining is 7,000 → picker shows, transport by default
 await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);walletForm('pay',S.orders[0].id)});await p.waitForSelector('#mform',{state:'attached'});await p.fill('#f_wAmt','8000');await p.waitForTimeout(100);
 ok(await p.evaluate(()=>!document.querySelector('#wXtra').hidden),'extra picker appears');
 const hint=await p.textContent('#wHint');ok(/الزيادة 1,000 تنسجل نقل من المصنع/.test(hint),'hint explains the extra: '+hint);
 await p.screenshot({path:OS.tmpdir()+'/payx_admin.png'});
 await save(p);await p.waitForFunction(()=>S.payments.length===2&&S.ctx.length===2);
 ok(await p.evaluate(()=>ordRem(S.orders[0])===0),'order exactly paid (remaining 0, not negative)');
 ok(await p.evaluate(()=>S.payments.map(x=>+x.amount).sort((a,b)=>a-b).join()==='3000,7000'),'payment recorded = remaining 7,000');
 ok(await p.evaluate(o=>{const f=S.ctx.find(x=>x.type==='fee');return f&&f.ft==='نقل'&&+f.amt===1000&&f.orderId===S.orders[0].id&&f.carrierId===o},cid),'1,000 recorded as transport on same order + company');
 ok(await p.evaluate(o=>walletBal(o).CNY===59000,cid),'wallet down by full 11,000 → 59,000');
 // already fully paid: everything typed is extra; choose "أخرى"
 await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);walletForm('pay',S.orders[0].id)});await p.waitForSelector('#mform',{state:'attached'});await p.fill('#f_wAmt','500');
 await p.click('[data-act=w-seg][data-k=xt][data-v="أخرى"]');await save(p);await p.waitForFunction(()=>S.ctx.length===3);
 ok(await p.evaluate(()=>S.payments.length===2&&S.ctx.some(x=>x.ft==='أخرى'&&+x.amt===500)),'paid order: whole amount → other fee, no 0 payment');
 ok(await p.evaluate(o=>walletBal(o).CNY===58500,cid),'wallet 58,500');
 ok(errs.length===0,'admin js errors '+errs.join('|'));
 const store=await p.evaluate(()=>localStorage.getItem('mockdb'));await ctx.close();
 // staff (Chinese screen): wording translated
 ({p,ctx,errs}=await page(b,'staff'));await p.evaluate(s=>localStorage.setItem('mockdb',s),store.replace(/"companyId":"main"/g,'"companyId":"yiwu"'));await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 const n=await p.evaluate(()=>S.orders.length);
 if(n){await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);walletForm('pay',S.orders[0].id)});await p.waitForSelector('#mform',{state:'attached'});await p.fill('#f_wAmt','100');await p.waitForTimeout(600);
  const t=await p.evaluate(()=>document.querySelector('#wXtra').innerText+' | '+document.querySelector('#wHint').innerText);
  ok(/超出剩余的部分是什么/.test(t)&&/从工厂转运/.test(t)&&!/[؀-ۿ]/.test(t),'staff sees Chinese: '+t);
  await p.screenshot({path:OS.tmpdir()+'/payx_staff.png'});
 } else console.log('note: staff company has no orders (admin data was main) - chinese check skipped');
 ok(errs.length===0,'staff js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
