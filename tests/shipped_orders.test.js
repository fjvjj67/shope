// Shipped orders move to the shipments page; wrong clicks can be undone; money never changes (js/shipped.js).
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
 await p.evaluate(()=>demoLoad());await p.waitForFunction(()=>S.orders.length>=3);await p.waitForTimeout(300);
 const oid=await p.evaluate(()=>S.orders.find(o=>o.stage==='ready').id);
 const money0=await p.evaluate(id=>(o=>{const i=oi(o);return JSON.stringify([i.total,i.paid,i.remaining,i.scheduled,S.carriers.map(c=>walletBal(c.id))])})(byId('orders',id)),oid);
 // mark shipped from the order page
 await p.evaluate(id=>openOrder(id),oid);await p.click('.modal [data-act=next-stage]');
 await p.waitForFunction(id=>byId('orders',id).stage==='shipped',oid);
 ok(await p.evaluate(id=>byId('orders',id).shippedAt===todayISO(),oid),'ship date saved');
 await p.evaluate(()=>{closeModal(true);FL.orders.st='';FL.orders.q='';go('orders')});await p.waitForTimeout(300);
 const ref=await p.evaluate(id=>byId('orders',id).ref,oid);
 ok(!(await p.textContent('#list')).includes(ref),'left the default orders list');
 await p.fill('#q_orders',ref);await p.waitForTimeout(200);ok((await p.textContent('#list')).includes(ref),'search still finds it');
 await p.evaluate(()=>{FL.orders.q='';FL.orders.st='shipped';go('orders')});await p.waitForTimeout(200);ok((await p.textContent('#list')).includes(ref),'filter «تم الشحن» shows it');
 await p.evaluate(()=>{FL.orders.st='';go('shipments')});await p.waitForTimeout(400);
 ok(await p.evaluate(r=>[...document.querySelectorAll('.card.shp')].some(c=>c.textContent.includes(r)&&c.textContent.includes(fmtD(todayISO()))),ref),'card on shipments page with date');
 await p.screenshot({path:(process.env.OUT||OS.tmpdir())+'/SO-way.png'});
 // wrong click → undo
 await p.click(`.card.shp [data-act=stage-back][data-id="${oid}"]`);await p.waitForFunction(id=>byId('orders',id).stage==='ready',oid);
 ok(await p.evaluate(id=>!('shippedAt' in byId('orders',id)),oid),'undo: back to ready, ship date removed');
 // ship again, then arrived
 await p.evaluate(id=>{go('orders');openOrder(id)},oid);await p.click('.modal [data-act=next-stage]');await p.waitForFunction(id=>byId('orders',id).stage==='shipped',oid);
 await p.evaluate(()=>{closeModal(true);go('shipments')});await p.waitForTimeout(300);
 await p.click(`[data-act=ord-arrived][data-id="${oid}"]`);await p.waitForFunction(id=>byId('orders',id).stage==='received',oid);
 ok(await p.evaluate(id=>byId('orders',id).receivedAt===todayISO(),oid),'arrived: received + date');
 await p.click('[data-act=shp-tab][data-v=got]');await p.waitForTimeout(250);
 ok((await p.textContent('.shp-list')).includes(ref),'shows under وصلت');
 await p.screenshot({path:(process.env.OUT||OS.tmpdir())+'/SO-got.png'});
 await p.click(`[data-act=stage-back][data-id="${oid}"]`);await p.waitForFunction(id=>byId('orders',id).stage==='shipped',oid);
 ok(await p.evaluate(id=>!('receivedAt' in byId('orders',id))&&byId('orders',id).shippedAt===todayISO(),oid),'undo arrived: back on the way');
 // order form: stage back to production drops the dates
 await p.evaluate(id=>orderForm(byId('orders',id)),oid);await p.waitForSelector('#mform');
 await p.evaluate(()=>{document.querySelector('details.more').open=true;document.getElementById('f_stage').value='production'});
 await p.click('.modal .mf .btn:not(.ghost)');await p.waitForFunction(id=>byId('orders',id).stage==='production',oid);
 ok(await p.evaluate(id=>!('shippedAt' in byId('orders',id)),oid),'form stage change clears ship date');
 const money1=await p.evaluate(id=>(o=>{const i=oi(o);return JSON.stringify([i.total,i.paid,i.remaining,i.scheduled,S.carriers.map(c=>walletBal(c.id))])})(byId('orders',id)),oid);
 ok(money0===money1,'money unchanged: '+money0+' / '+money1);
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll');
 ok(errs.length===0,'js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
