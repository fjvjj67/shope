// Editing a payment made through a shipping company to MORE than the order remaining (forgot the transport):
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
 // money in + order of 10,000 ¥
 // money in + order 22,920 + payments 1,000 and 21,920 (like rasool no.85)
 await p.evaluate(()=>{go('home');document.querySelector('#view [data-act=w-in]').click()});await p.waitForSelector('#mform',{state:'attached'});await p.fill('#f_wAmt','50000');await save(p);
 await p.waitForFunction(()=>S.ctx.length===1);
 await p.waitForTimeout(400);await p.evaluate(()=>{closeModal(true);go('orders');orderForm(null)});await p.waitForSelector('#nfBox',{timeout:5000});
 await p.fill('#f_newFactory','تفلون');await p.click('[data-act=ref-mode]');await p.fill('#f_ref','rasool no.85');await p.fill('#f_total','22920');await save(p);
 await p.waitForFunction(()=>S.orders.length===1);
 for(const a of ['1000','21920']){await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);walletForm('pay',S.orders[0].id)});await p.waitForSelector('#mform',{state:'attached'});await p.fill('#f_wAmt',a);await save(p);await p.waitForFunction(n=>S.payments.length===n,a==='1000'?1:2)}
 const cid=await p.evaluate(()=>S.carriers[0].id);const bal0=await p.evaluate(c=>walletBal(c).CNY,cid);
 // edit the last payment to 22,330
 await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);paymentForm(S.payments.find(x=>+x.amount===21920),null)});await p.waitForSelector('#mform',{state:'attached'});
 ok(await p.evaluate(()=>document.querySelector('#pXtra').hidden),'no extra picker before change');
 await p.fill('#f_amount','22330');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>!document.querySelector('#pXtra').hidden&&/410/.test(document.querySelector('#phint').textContent)),'shows extra 410: '+await p.textContent('#phint'));
 await save(p);await p.waitForFunction(()=>S.ctx.some(x=>x.type==='fee'));
 let st=await p.evaluate(()=>{const pay=S.payments.find(x=>x.amount>20000);const fee=S.ctx.find(x=>x.type==='fee');return {amt:pay.amount,fee:fee.amt,ft:fee.ft,link:fee.payId===pay.id,rem:ordRem(S.orders[0]),tot:payWithExtras(pay,'CNY').total}});
 ok(st.amt===21920&&st.fee===410&&st.ft==='نقل'&&st.link&&st.rem===0&&st.tot===22330,'split saved: '+JSON.stringify(st));
 ok(await p.evaluate((a)=>walletBal(a.c).CNY===a.b-410,{c:cid,b:bal0}),'carrier balance down by 410');
 // reopen: shows 22,330; change to 22,500 → fee 580 (same record)
 await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);paymentForm(S.payments.find(x=>x.amount>20000),null)});await p.waitForSelector('#mform',{state:'attached'});
 ok(await p.evaluate(()=>num2(document.getElementById('f_amount').value)===22330),'edit shows full 22,330');
 await p.fill('#f_amount','22500');await save(p);await p.waitForFunction(()=>S.ctx.find(x=>x.type==='fee').amt===580);
 ok(await p.evaluate(()=>S.ctx.filter(x=>x.type==='fee').length===1),'one fee record kept');
 // back to 21,920 → fee 0, not shown on statement
 await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);paymentForm(S.payments.find(x=>x.amount>20000),null)});await p.waitForSelector('#mform',{state:'attached'});
 await p.fill('#f_amount','21920');await save(p);await p.waitForFunction(()=>S.ctx.find(x=>x.type==='fee').amt===0);
 ok(await p.evaluate(c=>!walletRows(c).some(r=>r.k==='fee')&&walletBal(c).CNY===50000-22920,cid),'zero fee hidden, balance correct');
 // direct payment (no shipping company) above remaining is still refused
 await p.waitForTimeout(500);await p.evaluate(()=>{closeModal(true);paymentForm(S.payments.find(x=>x.amount>20000),null)});await p.waitForSelector('#mform',{state:'attached'});
 await p.selectOption('#f_via','');await p.fill('#f_amount','23000');await save(p);await p.waitForTimeout(300);
 ok((await p.textContent('#ferr')).includes('يتجاوز'),'direct payment over remaining refused');
 ok(errs.length===0,'js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
