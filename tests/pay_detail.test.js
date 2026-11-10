// A factory payment that carried transport/fees shows one full number; tapping it shows the split.
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
const D=[],A=(col,id,data)=>D.push({col,id,data:Object.assign({createdAt:1,companyId:'yiwu'},data)});
A('companies','yiwu',{name:'ايو'});A('carriers','c1',{name:'شركة الشحن'});A('factories','f1',{name:'صوندات'});
A('orders','o1',{ref:'ZA 150',factoryId:'f1',currency:'CNY',total:10000,orderDate:'2026-11-01',stage:'production'});
A('orders','o2',{ref:'ZA 151',factoryId:'f1',currency:'CNY',total:5000,orderDate:'2026-11-01',stage:'production'});
A('ctx','in1',{type:'in',status:'ok',carrierId:'c1',amt:50000,cur:'CNY',date:'2026-11-01',at:1});
// older entries (before linking): payment + transport same order/day/company
A('payments','old1',{orderId:'o2',amount:5000,paid:true,paidDate:'2026-11-02',dueDate:'2026-11-02',via:'c1',label:''});
A('ctx','oldfee',{type:'fee',ft:'نقل',carrierId:'c1',orderId:'o2',amt:300,cur:'CNY',date:'2026-11-02',note:'ويا دفعة الطلب',at:2});
const store=JSON.stringify({docs:D});
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 let {p,ctx,errs}=await page(b,'admin',store);
 await p.evaluate(()=>switchCompany('yiwu'));await p.waitForTimeout(200);
 // first payment 3,000, then 8,000 (7,000 remaining + 1,000 transport)
 await p.evaluate(()=>walletForm('pay','o1'));await p.waitForSelector('#f_wAmt');await p.fill('#f_wAmt','3000');await save(p);await p.waitForFunction(()=>S.payments.length===2);
 await p.waitForTimeout(400);await p.evaluate(()=>{closeModal(true);walletForm('pay','o1')});await p.waitForSelector('#f_wAmt');await p.fill('#f_wAmt','8000');await p.fill('#f_wXNote','نقل للمخزن');await save(p);
 await p.waitForFunction(()=>S.payments.length===3&&S.ctx.length===3);
 const pid=await p.evaluate(()=>S.payments.find(x=>x.orderId==='o1'&&+x.amount===7000).id);
 ok(await p.evaluate(id=>S.ctx.find(x=>x.type==='fee'&&x.orderId==='o1').payId===id,pid),'transport linked to its payment');
 // order view
 await p.evaluate(()=>{closeModal(true);openOrder('o1')});await p.waitForTimeout(300);
 const t=await p.textContent('#mform');
 ok(t.includes('الدفعة الثانية · ¥8,000'),'payment shows full number 8,000');
 ok(t.includes('الدفعة الأولى · ¥3,000'),'plain payment unchanged');
 ok(t.includes('للطلب ¥7,000 + نقل ¥1,000'),'split line under it');
 ok(await p.evaluate(()=>ordRem(byId('orders','o1'))===0&&walletBal('c1').CNY===33700),'order paid exactly, balance 50,000 −11,000 −5,300 = 33,700');
 await p.screenshot({path:OS.tmpdir()+'/pd_order.png'});
 // tap → details
 await p.click('[data-act=pay-detail]');await p.waitForTimeout(250);
 const d=await p.evaluate(()=>document.querySelector('.modal').innerText);ok(!/<bdi|bdi>/.test(d)&&/تفاصيل الدفعة · ¥8,000/.test(d),'clean title');
 ok(/دفعة للمصنع \(سعر الطلب\)\s*¥7,000/.test(d)&&/نقل من المصنع[\s\S]*نقل للمخزن[\s\S]*¥1,000/.test(d)&&/المجموع اللي انخصم من رصيدك\s*¥8,000/.test(d),'details split + note + total: '+d.replace(/\n/g,' / '));
 ok(/مدفوع بالكامل/.test(d)&&/مجموع النقل والمصاريف على هذا الطلب\s*¥1,000/.test(d),'order status and fee sum');
 ok(await p.evaluate(()=>!!document.querySelector('.modal [data-act=edit-payment]')&&!!document.querySelector('.modal [data-act=edit-ctx]')),'edit buttons for payment and transport');
 await p.screenshot({path:OS.tmpdir()+'/pd_detail.png'});
 await p.click('.modal [data-act=close]');await p.waitForTimeout(250);
 ok(await p.evaluate(()=>/طلب ZA 150/.test(document.querySelector('.modal')&&document.querySelector('.modal').innerText||'')),'close returns to the order');
 // edit transport from details → total follows
 await p.click('[data-act=pay-detail]');await p.waitForTimeout(200);await p.click('.modal [data-act=edit-ctx]');await p.waitForTimeout(200);await p.fill('#f_wAmt','1200');await save(p);
 await p.waitForFunction(()=>+S.ctx.find(x=>x.type==='fee'&&x.orderId==='o1').amt===1200);await p.evaluate(()=>{closeModal(true);openOrder('o1')});await p.waitForTimeout(200);
 ok((await p.textContent('#mform')).includes('¥8,200'),'after editing transport the payment shows 8,200');
 // older entry matched by order + day + company
 await p.evaluate(()=>{closeModal(true);openOrder('o2')});await p.waitForTimeout(200);
 ok((await p.textContent('#mform')).includes('¥5,300')&&(await p.textContent('#mform')).includes('للطلب ¥5,000 + نقل ¥300'),'older payment + transport shown together');
 // payments page
 await p.evaluate(()=>{closeModal(true);go('payments')});await p.waitForTimeout(300);
 const pg=await p.textContent('#view');ok(pg.includes('¥8,200')&&pg.includes('للطلب ¥7,000 + نقل ¥1,200'),'payments page shows full number + split');
 ok(errs.length===0,'admin js errors '+errs.join('|'));
 const st=await p.evaluate(()=>localStorage.getItem('mockdb'));await ctx.close();
 ({p,ctx,errs}=await page(b,'staff',st));await p.evaluate(()=>openOrder('o1'));await p.waitForTimeout(500);await p.click('[data-act=pay-detail]');await p.waitForTimeout(700);
 const z=await p.evaluate(()=>document.querySelector('.modal').innerText);
 ok(!/bdi/.test(z)&&/付款明细/.test(z)&&/从你余额扣除的总额/.test(z),'staff details in Chinese: '+z.replace(/\n/g,' / ').slice(0,160));
 ok(errs.length===0,'staff js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
