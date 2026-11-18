// Form controls (js/pickers.js): factory sheet with search, dates as 18/11/2026, اليوم/أمس chips, currency in total.
// (head from) Editing a payment made through a shipping company to MORE than the order remaining (forgot the transport):
// the order keeps exactly its remaining, the extra becomes a transport fee linked to that payment; edit again changes it.
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
 await p.evaluate(async()=>{for(const n of ['تفلون','صوندات','جوجي']){await put('factories',{id:newId('factories'),createdAt:Date.now(),name:n,city:'',contact:'',phone:'',note:''},{quiet:true})}});
 await p.waitForFunction(()=>S.factories.length===3);
 await p.evaluate(()=>{go('orders');orderForm()});await p.waitForSelector('.fpick');
 ok(await p.evaluate(()=>getComputedStyle(document.getElementById('f_factoryId')).opacity==='0'),'native select hidden');
 await p.click('.fpick');await p.waitForSelector('#fsheet');
 await p.fill('.fs-q','جو');await p.waitForTimeout(100);
 ok(await p.evaluate(()=>[...document.querySelectorAll('.fs-all .fs-row')].filter(r=>!r.hidden).map(r=>r.querySelector('b').textContent).join()==='جوجي'),'search filters');
 await p.click('.fs-all .fs-row:not([hidden])');
 ok(await p.evaluate(()=>!document.getElementById('fsheet')&&byId('factories',document.getElementById('f_factoryId').value).name==='جوجي'&&/جوجي/.test(document.querySelector('.fpick').textContent)),'pick sets the select');
 ok(await p.evaluate(()=>/^\d\d\/\d\d\/\d{4}/.test(document.querySelector('.dshow').textContent)),'date shown dd/mm/yyyy: '+await p.textContent('.dshow'));
 await p.click('.dq .chip:nth-child(2)');ok(await p.evaluate(()=>document.getElementById('f_orderDate').value===addDays(todayISO(),-1)),'أمس chip');
 await p.click('[data-act=dur][data-d="30"]');ok(await p.evaluate(()=>{const v=document.getElementById('f_prepDate').value;return v&&document.querySelectorAll('.dshow')[1].textContent.startsWith(fmtD(v))}),'prep date display follows chip');
 ok(await p.evaluate(()=>document.querySelector('.cin .cs').textContent==='¥'),'¥ inside total');
 await p.fill('#f_total','12500');await p.click('.modal .mf .btn:not(.ghost)');await p.waitForFunction(()=>S.orders.length===1);
 ok(await p.evaluate(()=>{const o=S.orders[0];return byId('factories',o.factoryId).name==='جوجي'&&o.total===12500&&o.orderDate===addDays(todayISO(),-1)}),'order saved with picked factory, total and date');
 // new factory from the sheet
 await p.evaluate(()=>{closeModal(true);orderForm()});await p.click('.fpick');await p.click('[data-fs=new]');
 ok(await p.evaluate(()=>!document.getElementById('nfBox').hidden&&document.querySelector('.fpick').hidden),'new factory from sheet opens the name box');
 await p.click('[data-act=nf-toggle]');ok(await p.evaluate(()=>document.getElementById('nfBox').hidden&&!document.querySelector('.fpick').hidden&&document.querySelector('[data-act=nf-toggle]').hidden),'back to the list: picker full width again');
 // payment form: paid date set by code shows in the box
 await p.evaluate(()=>{closeModal(true);paymentForm(null,S.orders[0].id)});await p.waitForSelector('#f_paid',{state:'attached'});await p.click('#f_paid');
 ok(await p.evaluate(()=>{const d=document.getElementById('f_paidDate');return d.value===todayISO()&&d.closest('.dwrap').querySelector('.dshow').textContent.startsWith(fmtD(todayISO()))}),'date set by code updates the display');
 for(const [n,f] of [['wallet-in',()=>{closeModal(true);walletForm('in')}],['ship',()=>{closeModal(true);shipmentForm(null)}]]){await p.evaluate(f);await p.waitForTimeout(400);await p.screenshot({path:(process.env.OUT||OS.tmpdir())+'/K-'+n+'.png'})}
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll');
 ok(errs.length===0,'js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
