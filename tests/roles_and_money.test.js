const ROOT=require('path').resolve(__dirname,'..'),OUT=process.env.OUT||require('os').tmpdir();
const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');
let ExcelJS=null;try{ExcelJS=require('exceljs')}catch(e){}
const html=fs.readFileSync(ROOT+'/index.html','utf8'),mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
async function page(b,role,vw){const ctx=await b.newContext({viewport:vw||{width:390,height:844},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>{errs.push(e.message);console.log('STACK',(e.stack||'').split('\n').slice(0,4).join(' | '))});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u==='https://app.test/')return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
  if(u.endsWith('/lib/supabase.min.js'))return r.fulfill({contentType:'text/javascript',body:'window.__ROLE="'+role+'";'+mock});
  if(u.includes('/functions/v1/pin-login')){const b=JSON.parse(r.request().postData()||'{}');return b.pin==='1234'?r.fulfill({contentType:'application/json',body:JSON.stringify({access_token:'tok',refresh_token:'r'})}):r.fulfill({status:401,contentType:'application/json',body:'{"error":"bad"}'})}
  if(u.startsWith('https://app.test/')){const f=ROOT+'/'+u.replace('https://app.test/','').split('?')[0];return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'text/javascript':'font/woff2'}):r.fulfill({status:404,body:''})}
  return r.abort()});
 await p.goto('https://app.test/');return {p,ctx,errs}}
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 // admin login by PIN
 let {p,ctx,errs}=await page(b,'admin');
 await p.waitForSelector('#aPin');ok(!(await p.content()).includes('signInWithPassword'),'no email/password login');console.log('step login form');
 ok(!html.includes('admin@azawi.app')&&!html.includes('staff@azawi.app'),'no account emails in page code');
 ok(!/service_role/.test(html),'no service key in page');
 await p.fill('#aPin','9999');await p.click('#aGo');await p.waitForTimeout(300);ok((await p.textContent('#aErr')).includes('غير صحيح'),'wrong PIN rejected');
 await p.fill('#aPin','1234');await p.click('#aGo');await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 ok(await p.evaluate(()=>ADMIN===true),'admin logged in by PIN');console.log('step logged');
 // full flow
 await p.evaluate(()=>{go('home')});await p.waitForTimeout(200);
 console.log('dbg',await p.evaluate(()=>{const e=document.querySelector('#view [data-act=w-in]');if(!e)return 'none';const r=e.getBoundingClientRect();const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.y+' '+r.height+' top='+(t&&(t.className||t.tagName))}));await p.evaluate(()=>document.querySelector('#view [data-act=w-in]').click());await p.waitForSelector('#mform');await p.fill('#f_wPaid','13350000');await p.fill('#f_wAmt','70000');await p.click('.modal .mf .btn:not(.ghost)');
 await p.waitForFunction(()=>S.ctx.length===1);ok(await p.evaluate(()=>walletBal(S.carriers[0].id).CNY===70000),'send money → wallet 70,000 ¥');
 await p.evaluate(()=>{go('orders');orderForm(null)});await p.waitForSelector('#nfBox');
 await p.fill('#f_newFactory','مصنع دريلات');await p.click('[data-act=ref-mode]');await p.fill('#f_ref','A-1');await p.fill('#f_total','10000');await p.click('.modal .mf .btn:not(.ghost)');
 await p.waitForFunction(()=>S.orders.length===1&&S.factories.length===1);ok(await p.evaluate(()=>S.orders[0].currency==='CNY'),'order + factory created, RMB');
 await p.evaluate(()=>walletForm('pay',S.orders[0].id));await p.waitForSelector('#mform');await p.click('[data-act=w-seg][data-k=pm][data-v=full]');await p.click('.modal .mf .btn:not(.ghost)');
 await p.waitForFunction(()=>S.payments.length===1);ok(await p.evaluate(()=>walletBal(S.carriers[0].id).CNY===60000&&ordRem(S.orders[0])===0),'full payment via carrier: wallet 60,000, order paid');
 await p.evaluate(()=>{console.log(!!document.querySelector('#layer .modal'));closeModal(true);go('backup')});await p.waitForTimeout(200);
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:60000}),p.click('[data-act=export-xlsx]')]);
 const path=await dl.path();const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(path);ok(wb.worksheets.length>=5&&/^AZAWI-/.test(dl.suggestedFilename()),'Excel downloads: '+dl.suggestedFilename());
 await p.evaluate(()=>{closeModal(true);go('users')});await p.waitForTimeout(300);const ut=await p.textContent('#view');ok(ut.includes('الموظف')&&ut.includes('موظف')&&!ut.includes('@azawi.app'),'users page: names + roles, no emails');
 ok(errs.length===0,'admin js errors: '+errs);
 const store=await p.evaluate(()=>localStorage.getItem('mockdb'));await ctx.close();
 // staff
 ({p,ctx,errs}=await page(b,'staff'));await p.evaluate(s=>localStorage.setItem('mockdb',s),store);await p.reload();await p.waitForSelector('#aPin');await p.fill('#aPin','1234');await p.click('#aGo');
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 ok(await p.evaluate(()=>!ADMIN&&CANEDIT&&!document.body.classList.contains('ro')&&document.body.classList.contains('nodel')),'staff = edit, no delete');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#view [data-act=w-in]')).display!=='none'),'staff sees send-money');
 const r=await p.evaluate(async()=>{try{await put('ctx',{id:'x1',type:'in',amt:5,cur:'CNY',date:todayISO(),status:'ok'});return 'ok'}catch(e){return 'blocked'}});ok(r==='ok','staff can write wallet');
 ok(await p.evaluate(()=>[...document.querySelectorAll('[data-act=del-ask],[data-act=del-file]')].every(e=>getComputedStyle(e).display==='none')),'staff sees no delete buttons');
 const dr=await p.evaluate(async()=>{try{await remove('orders',S.orders[0].id);return 'ok'}catch(e){return 'blocked'}});ok(dr==='blocked','staff delete blocked');
 await p.evaluate(()=>{go('orders');document.querySelector('#topact [data-act=new-order]').click()});await p.waitForSelector('#mform');
 ok(await p.evaluate(()=>!!document.querySelector('[data-act=nf-toggle]')),'staff can add factories inline');
 await p.evaluate(()=>{const b=document.getElementById('nfBox');if(b&&b.hidden){const t=document.querySelector('[data-act=nf-toggle]');t&&t.click()}});if(await p.$('#f_newFactory'))await p.fill('#f_newFactory','义乌工厂');await p.click('[data-act=ref-mode]');await p.fill('#f_ref','S-1');await p.fill('#f_total','500');await p.click('.modal .mf .btn:not(.ghost)');await p.waitForFunction(()=>S.orders.some(o=>o.ref==='S-1'));ok(await p.evaluate(()=>S.orders.every(o=>o.companyId==='yiwu')&&ACTIVE==='yiwu'&&S.companies.length===1),'staff can add order, locked to Yiwu');
 ok(await p.evaluate(()=>NAV.filter(navOk).map(n=>n[0]).includes('companies')&&!NAV.filter(navOk).map(n=>n[0]).includes('users')),'staff: accounts yes, users no');
 ok(errs.length===0,'staff js errors: '+errs);await ctx.close();
 // suspended
 ({p,ctx,errs}=await page(b,'pending'));await p.waitForSelector('#aPin');await p.fill('#aPin','1234');await p.click('#aGo');await p.waitForTimeout(500);
 ok((await p.textContent('#auth')).includes('لم يُفعَّل'),'suspended account blocked');await ctx.close();
 // laptop smoke
 ({p,ctx,errs}=await page(b,'admin',{width:1440,height:900}));await p.evaluate(s=>{localStorage.setItem('mockdb',s);localStorage.setItem('mocksess','1')},store);await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));await p.waitForTimeout(400);
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.dash')).display==='grid'),'laptop dashboard grid');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
 await p.screenshot({path:'/tmp/pgtest/gh-desk.png'});ok(errs.length===0,'desk js errors');
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n').slice(0,14).join(' | '));process.exit(1)});
