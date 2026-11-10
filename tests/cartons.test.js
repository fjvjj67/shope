// Cartons reaching the shipping company's warehouse in China: total on the order, arrivals in batches,
// "all arrived" fills the rest, home alert while cartons are missing, staff sees it in Chinese.
const ROOT=require('path').resolve(__dirname,'..'),OS=require('os');
const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');
const html=fs.readFileSync(ROOT+'/index.html','utf8'),mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
async function page(b,role,store){const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u==='https://app.test/')return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
  if(u.endsWith('/lib/supabase.min.js'))return r.fulfill({contentType:'text/javascript',body:'window.__ROLE="'+role+'";'+mock});
  if(u.startsWith('https://app.test/')){const f=ROOT+'/'+u.replace('https://app.test/','').split('?')[0];return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'text/javascript':'font/woff2'}):r.fulfill({status:404,body:''})}
  return r.abort()});
 await p.goto('https://app.test/');await p.evaluate(s=>{localStorage.setItem('mocksess','1');if(s)localStorage.setItem('mockdb',s)},store||'');await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));return {p,ctx,errs}}
const save=p=>p.click('.modal .mf .btn[type=submit]');
const open=async(p,fn)=>{await p.evaluate(fn);await p.waitForSelector('#mform',{state:'attached'})};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 let {p,ctx,errs}=await page(b,'admin');
 await open(p,()=>{go('orders');orderForm(null)});
 await p.fill('#f_newFactory','صوندات');await p.click('[data-act=ref-mode]');await p.fill('#f_ref','rasool no.78');await p.fill('#f_total','122148');await p.fill('#f_cartons','120');await save(p);
 await p.waitForFunction(()=>S.orders.length===1);ok(await p.evaluate(()=>S.orders[0].cartons===120),'order saved with 120 cartons');
 const oid=await p.evaluate(()=>S.orders[0].id);
 await p.evaluate(()=>{closeModal(true);go('home')});await p.waitForTimeout(200);
 ok(!(await p.textContent('#view')).includes('كراتين ناقصة'),'no alert before anything arrived (still in production)');
 // batch 1
await p.evaluate(id=>{closeModal(true);openOrder(id)},oid);await p.waitForTimeout(100);
 ok((await p.textContent('#mform')).includes('الكراتين بالمخزن'),'cartons section in order');
 await p.click('[data-act=ctn-add]');await p.waitForTimeout(100);await p.fill('#f_n','30');await p.fill('#f_note','الوجبة الأولى');await save(p);
 await p.waitForFunction(()=>S.ctn.length===1);await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!!document.querySelector('[data-act=ctn-add]')),'back to the order after saving');
 await p.click('[data-act=ctn-add]');await p.waitForTimeout(100);await p.fill('#f_n','50');await save(p);await p.waitForFunction(()=>S.ctn.length===2);await p.waitForTimeout(200);
 ok(await p.evaluate(id=>{const c=ctnInfo(byId('orders',id));return c.got===80&&c.left===40},oid),'80 of 120, 40 left');
 const t=await p.textContent('#mform');ok(/المجموع120/.test(t.replace(/\s/g,''))&&t.includes('50 كرتونة')&&t.includes('الوجبة الأولى'),'section shows totals and batches');
 await p.screenshot({path:OS.tmpdir()+'/ctn_order.png'});
 // validation
 await p.click('[data-act=ctn-add]');await p.waitForTimeout(100);await p.fill('#f_n','2.5');await save(p);await p.waitForTimeout(150);
 ok(await p.evaluate(()=>!document.querySelector('#ferr').hidden&&S.ctn.length===2),'rejects non-whole number');
 await p.evaluate(()=>closeModal(true));
 // home alert
 await p.evaluate(()=>go('home'));await p.waitForTimeout(250);const h=await p.textContent('#view');
 ok(h.includes('كراتين ناقصة للطلب rasool no.78: باقي 40'),'home alert while cartons are missing');
 await p.screenshot({path:OS.tmpdir()+'/ctn_home.png'});
 // edit batch
 const e1=await p.evaluate(()=>S.ctn.find(x=>+x.n===50).id);
 await p.evaluate(id=>{const x=byId('ctn',id);ctnForm(x.orderId,id)},e1);await p.waitForTimeout(100);await p.fill('#f_n','60');await save(p);
 await p.waitForFunction(()=>S.ctn.some(x=>+x.n===60));ok(await p.evaluate(id=>ctnInfo(byId('orders',id)).left===30,oid),'edit batch → 30 left');
 // all arrived
 await p.evaluate(id=>{closeModal(true);openOrder(id)},oid);await p.waitForTimeout(100);await p.click('[data-act=ctn-all]');await p.waitForTimeout(100);
 ok(await p.inputValue('#f_n')==='30','"all arrived" pre-fills the remaining 30');await save(p);
 await p.waitForFunction(()=>S.ctn.length===3);ok(await p.evaluate(id=>{const c=ctnInfo(byId('orders',id));return c.left===0&&c.got===120},oid),'all 120 arrived');
 ok(await p.evaluate(()=>!document.querySelector('[data-act=ctn-all]')),'"all arrived" button hidden when nothing left');
 await p.evaluate(()=>{closeModal(true);go('home')});await p.waitForTimeout(250);ok(!(await p.textContent('#view')).includes('كراتين ناقصة'),'alert gone when complete');
 // order without total: batches still recorded
 ok(await p.evaluate(()=>{const o={id:'x',cartons:0};return ctnInfo(o).left===0}),'no total → no "left"');
 ok(errs.length===0,'admin js errors '+errs.join('|'));
 const store=(await p.evaluate(()=>localStorage.getItem('mockdb'))).replace(/"companyId":"main"/g,'"companyId":"yiwu"');await ctx.close();
 // staff (Chinese) adds a batch
 ({p,ctx,errs}=await page(b,'staff',store));
 const o2=await p.evaluate(()=>S.orders[0]&&S.orders[0].id);ok(!!o2,'staff sees the order');
 await p.evaluate(id=>{const o=byId('orders',id);put('orders',Object.assign({},o,{cartons:150}))},o2);await p.waitForTimeout(200);
 await p.evaluate(id=>openOrder(id),o2);await p.waitForTimeout(700);
 const zt=await p.evaluate(()=>{const s=[...document.querySelectorAll('#mform h3')].find(h=>h.querySelector('[data-act=ctn-add]'));return s.parentElement.innerText});
 ok(/仓库到箱/.test(zt)&&/还差/.test(zt)&&/箱/.test(zt)&&!/[؀-ۿ]/.test(zt.replace(/الوجبة/g,'')),'staff section in Chinese: '+zt.replace(/\n/g,' / '));
 await p.screenshot({path:OS.tmpdir()+'/ctn_staff.png'});
 await p.click('[data-act=ctn-add]');await p.waitForTimeout(500);
 const ft=await p.evaluate(()=>document.querySelector('.modal').innerText);ok(/到了多少箱/.test(ft)&&/已到 120 \/ 共 150/.test(ft),'staff form in Chinese: '+ft.replace(/\n/g,' / '));
 await p.fill('#f_n','10');await save(p);await p.waitForFunction(()=>S.ctn.length===4);ok(true,'staff can add a batch');
 await p.evaluate(()=>{closeModal(true);go('home')});await p.waitForTimeout(700);ok(/缺箱：还差 20/.test(await p.textContent('#view')),'staff home alert in Chinese');
 ok(errs.length===0,'staff js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
