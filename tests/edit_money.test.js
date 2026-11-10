// Editing transfers ("أرسلت فلوس", pending too) and fees ("شحن ونقل") from the shipping-company statement.
// Admin can always edit; the assistant only when the admin allows it for that account; delete stays admin-only.
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
const docs=co=>{const D=[],A=(col,id,data)=>D.push({col,id,data:Object.assign({createdAt:1,companyId:co},data)});
 A('companies','yiwu',{name:'ايو'});A('carriers','c1',{name:'شركة الشحن'});A('carriers','c2',{name:'شركة ثانية'});
 A('factories','f1',{name:'صوندات'});A('orders','o1',{ref:'ZA 140',factoryId:'f1',currency:'CNY',total:50000,orderDate:'2026-11-01',stage:'production'});
 A('ctx','t1',{type:'in',status:'ok',carrierId:'c1',paid:1500000,payCur:'IQD',amt:10000,cur:'CNY',date:'2026-11-05',note:'',at:1});
 A('ctx','t2',{type:'in',status:'wait',carrierId:'c1',paid:500000,payCur:'IQD',amt:0,cur:'CNY',date:'2026-11-09',note:'',at:2});
 A('ctx','f1x',{type:'fee',ft:'نقل',carrierId:'c1',orderId:'o1',amt:300,cur:'CNY',date:'2026-11-06',note:'',at:3});
 A('payments','p1',{orderId:'o1',amount:2000,paid:true,paidDate:'2026-11-07',dueDate:'2026-11-07',via:'c1',label:''});
 return JSON.stringify({docs:D})};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 let {p,ctx,errs}=await page(b,'admin',docs('yiwu'));
 await p.evaluate(()=>{switchCompany('yiwu')});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>ACTIVE==='yiwu'&&walletBal('c1').CNY===7700),'start balance 10,000 − 300 − 2,000 = 7,700');
 await p.evaluate(()=>stmtModal());await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.querySelectorAll('.modal [data-act=edit-ctx]').length===2&&!!document.querySelector('.modal [data-act=edit-payment]')),'admin: edit buttons on transfer, fee, factory payment');
 // edit transfer amount + note
 await p.click('.modal [data-act=edit-ctx][data-id=t1]');await p.waitForTimeout(150);
 ok(await p.inputValue('#f_wAmt')==='10000'&&await p.inputValue('#f_wPaid')==='1500000','form pre-filled');
 ok(/150/.test(await p.textContent('#wHint')),'rate hint shown: '+await p.textContent('#wHint'));
 await p.fill('#f_wAmt','12000');await p.fill('#f_wNote','صححت المبلغ');await p.screenshot({path:OS.tmpdir()+'/em_in.png'});await save(p);
 await p.waitForFunction(()=>+byId('ctx','t1').amt===12000);
 ok(await p.evaluate(()=>walletBal('c1').CNY===9700&&byId('ctx','t1').note==='صححت المبلغ'&&byId('ctx','t1').editedAt>0),'transfer edited → balance 9,700');
 ok(await p.evaluate(()=>S.ctx.length===3),'edit did not create a new entry');
 // move to another carrier
 await p.evaluate(()=>{closeModal(true);ctxEditForm('t1')});await p.waitForTimeout(150);await p.click('[data-act=w-pick][data-id=c2]');await save(p);
 await p.waitForFunction(()=>byId('ctx','t1').carrierId==='c2');ok(await p.evaluate(()=>walletBal('c2').CNY===12000&&walletBal('c1').CNY===-2300),'moved to the other shipping company');
 await p.evaluate(()=>{closeModal(true);ctxEditForm('t1')});await p.waitForTimeout(150);await p.click('[data-act=w-pick][data-id=c1]');await save(p);await p.waitForFunction(()=>byId('ctx','t1').carrierId==='c1');
 // validation
 await p.evaluate(()=>{closeModal(true);ctxEditForm('t1')});await p.waitForTimeout(150);await p.fill('#f_wAmt','');await save(p);await p.waitForTimeout(150);
 ok(await p.evaluate(()=>!document.querySelector('#ferr').hidden&&+byId('ctx','t1').amt===12000),'empty amount rejected');
 // pending transfer stays pending
 await p.evaluate(()=>{closeModal(true);ctxEditForm('t2')});await p.waitForTimeout(150);
 ok((await p.textContent('.modal h2, .modal .mh')).includes('بالانتظار')||(await p.textContent('.modal')).includes('تعديل حوالة بالانتظار'),'pending title');
 await p.fill('#f_wPaid','700000');await save(p);await p.waitForFunction(()=>+byId('ctx','t2').paid===700000);
 ok(await p.evaluate(()=>byId('ctx','t2').status==='wait'&&walletBal('c1').CNY===9700),'pending edited, still pending, not in balance');
 // fee type + amount
 await p.evaluate(()=>{closeModal(true);ctxEditForm('f1x')});await p.waitForTimeout(150);
 ok(await p.inputValue('#f_wAmt')==='300','fee pre-filled');await p.click('[data-act=w-seg][data-k=ft][data-v="أخرى"]');await p.fill('#f_wAmt','450');await p.screenshot({path:OS.tmpdir()+'/em_fee.png'});await save(p);
 await p.waitForFunction(()=>+byId('ctx','f1x').amt===450);ok(await p.evaluate(()=>byId('ctx','f1x').ft==='أخرى'&&walletBal('c1').CNY===9550),'fee edited → 9,550');
 // factory payment row opens the payment form
 await p.evaluate(()=>{closeModal(true);stmtModal()});await p.waitForTimeout(150);await p.click('.modal [data-act=edit-payment]');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!!document.querySelector('#mform')&&/دفعة|الدفعة/.test(document.querySelector('.modal').innerText)),'payment row opens payment edit');
 await p.evaluate(()=>closeModal(true));
 // admin allows assistant for ايو
 await p.evaluate(()=>{go('users')});await p.waitForTimeout(300);ok((await p.textContent('#view')).includes('تعديل الحسابات'),'permission card on users page');
 await p.screenshot({path:OS.tmpdir()+'/em_users.png'});
 const store0=await p.evaluate(()=>localStorage.getItem('mockdb'));
 await p.click('[data-act=money-edit-sw][data-co=yiwu]');await p.waitForFunction(()=>S.companies.find(c=>c.id==='yiwu').staffMoneyEdit===true);ok(true,'admin turned it on');
 const store1=await p.evaluate(()=>localStorage.getItem('mockdb'));
 ok(errs.length===0,'admin js errors '+errs.join('|'));await ctx.close();
 // staff without permission
 ({p,ctx,errs}=await page(b,'staff',store0));
 await p.evaluate(()=>stmtModal());await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!document.querySelector('.modal [data-act=edit-ctx]')),'assistant: no edit buttons when not allowed');
 await p.evaluate(()=>{closeModal(true);ctxEditForm('t1')});await p.waitForTimeout(200);ok(await p.evaluate(()=>!document.querySelector('#mform [name=wAmt], #f_wAmt')),'assistant: form refused when not allowed');
 await ctx.close();
 // staff with permission
 ({p,ctx,errs}=await page(b,'staff',store1));
 await p.evaluate(()=>stmtModal());await p.waitForTimeout(600);
 ok(await p.evaluate(()=>document.querySelectorAll('.modal [data-act=edit-ctx]').length===2&&!document.querySelector('.modal [data-act=del-ask]')),'assistant: edit yes, delete no');
 await p.click('.modal [data-act=edit-ctx][data-id=t1]');await p.waitForTimeout(600);
 const zt=await p.evaluate(()=>document.querySelector('.modal').innerText);ok(/编辑：汇款/.test(zt)&&!/[\u0600-\u06FF]/.test(zt.replace(/صححت المبلغ|ثانية/g,'')),'assistant form in Chinese: '+zt.replace(/\n/g,' / ').slice(0,200));
 await p.screenshot({path:OS.tmpdir()+'/em_staff.png'});
 ok(await p.evaluate(()=>!document.querySelector('.modal [data-act=del-ask], .modal .mdel:not([hidden])')),'assistant: no delete in form');
 await p.fill('#f_wAmt','12500');await save(p);await p.waitForFunction(()=>+byId('ctx','t1').amt===12500);ok(true,'assistant saved an edit');
 ok(errs.length===0,'staff js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
