// Accounts page: only the account picked at the top, plus its money transfers by month (sent, received ¥, rate, pending).
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
const t=new Date(),ym=t.toISOString().slice(0,7),d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const pm=(()=>{const x=new Date(t.getFullYear(),t.getMonth()-1,15);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-15'})();
const D=[],A=(col,id,data)=>D.push({col,id,data:Object.assign({createdAt:1},data)});
A('companies','main',{name:'كوانزو'});A('companies','yiwu',{name:'ايو'});
A('carriers','c1',{name:'شركة كوانزو',companyId:'main'});A('carriers','c2',{name:'شركة ايو',companyId:'yiwu'});
A('ctx','a1',{type:'in',status:'ok',carrierId:'c1',paid:19000000,payCur:'IQD',amt:100000,cur:'CNY',date:d(0)<ym+'-01'?ym+'-01':d(0),companyId:'main',at:1});
A('ctx','a2',{type:'in',status:'ok',carrierId:'c1',paid:7000,payCur:'USD',amt:50000,cur:'CNY',date:ym+'-01',companyId:'main',at:2});
A('ctx','a3',{type:'in',status:'wait',carrierId:'c1',paid:10000000,payCur:'IQD',amt:0,cur:'CNY',date:d(0),companyId:'main',at:3});
A('ctx','a4',{type:'in',status:'ok',carrierId:'c1',paid:9500000,payCur:'IQD',amt:50000,cur:'CNY',date:pm,companyId:'main',at:4});
A('ctx','a5',{type:'fee',ft:'نقل',carrierId:'c1',amt:300,cur:'CNY',date:d(0),companyId:'main',at:5});
A('ctx','b1',{type:'in',status:'ok',carrierId:'c2',paid:15200000,payCur:'IQD',amt:80000,cur:'CNY',date:d(0),companyId:'yiwu',at:1});
const store=JSON.stringify({docs:D});
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 let {p,ctx,errs}=await page(b,'admin',store);
 await p.evaluate(()=>{switchCompany('main');go('companies')});await p.waitForTimeout(300);
 let v=await p.textContent('#view');
 ok(v.includes('حساب كوانزو')&&!v.includes('حساب ايو')&&!v.includes('شركة ايو'),'only كوانزو shown');
 ok(await p.evaluate(()=>document.querySelectorAll('#view .tx-row').length===3),'this month: 3 transfers (fee not listed, last month hidden)');
 ok(v.includes('19,000,000 د.ع + 7,000 $')||v.replace(/\s/g,'').includes('29,000,000د.ع+7,000$'),'sent total: '+v.match(/دفعت[^س]{0,40}/));
 ok(v.includes('¥150,000'),'received ¥ = 150,000 (pending excluded)');
 ok(v.includes('190 د.ع'),'average yuan rate 190');
 ok(v.includes('حوالة بالانتظار: 10,000,000 د.ع'),'pending shown');
 ok(await p.evaluate(()=>!document.body.classList.contains('hasfab')&&!!document.querySelector('#view [data-act=new-company]')),'new-account moved into the card');
 await p.screenshot({path:OS.tmpdir()+'/acc_main.png'});
 // previous month + all
 const months=await p.evaluate(()=>[...document.querySelectorAll('[data-act=acct-m]')].map(b=>b.dataset.v));ok(months.length===3&&months[2]==='all','month chips: '+months);
 await p.click(`[data-act=acct-m][data-v="${months[1]}"]`);await p.waitForTimeout(150);
 ok(await p.evaluate(()=>document.querySelectorAll('#view .tx-row').length===1),'last month: 1 transfer');
 await p.click('[data-act=acct-m][data-v=all]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>document.querySelectorAll('#view .tx-row').length===4),'all: 4 transfers');
 // edit from here
 await p.click('#view .tx-row [data-act=edit-ctx]');await p.waitForTimeout(150);ok(await p.evaluate(()=>!!document.querySelector('#f_wAmt')),'edit opens from the list');
 await p.evaluate(()=>closeModal(true));
 // switch to ايو
 await p.evaluate(()=>switchCompany('yiwu'));await p.waitForTimeout(250);v=await p.textContent('#view');
 ok(v.includes('حساب ايو')&&!v.includes('حساب كوانزو')&&v.includes('¥80,000'),'switch → only ايو');
 await p.screenshot({path:OS.tmpdir()+'/acc_yiwu.png'});
 ok(errs.length===0,'admin js errors '+errs.join('|'));await ctx.close();
 // staff (Chinese, ايو only)
 ({p,ctx,errs}=await page(b,'staff',store));await p.evaluate(()=>go('companies'));await p.waitForTimeout(700);
 v=await p.evaluate(()=>document.querySelector('#view').innerText);
 ok(/汇款记录/.test(v)&&/11月|1[0-2]?月|\d月/.test(v)&&!/كوانزو/.test(v)&&!/[؀-ۿ]/.test(v.replace(/ايو|شركة/g,'')),'staff page in Chinese, ايو only: '+v.replace(/\n/g,' / ').slice(0,220));
 await p.screenshot({path:OS.tmpdir()+'/acc_staff.png'});
 ok(errs.length===0,'staff js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
