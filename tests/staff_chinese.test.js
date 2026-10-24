const ROOT=require('path').resolve(__dirname,'..'),OUT=process.env.OUT||require('os').tmpdir();
const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');
let ExcelJS=null;try{ExcelJS=require('exceljs')}catch(e){}
const html=fs.readFileSync(ROOT+'/index.html','utf8'),mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
async function page(b,role,vw){const ctx=await b.newContext({viewport:vw||{width:390,height:844},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>{errs.push(e.message);console.log('STACK',(e.stack||'').split('\n').slice(0,4).join(' | '))});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u==='https://app.test/')return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
  if(u.endsWith('/lib/supabase.min.js'))return r.fulfill({contentType:'text/javascript',body:'window.__ROLE="'+role+'";'+mock});
  if(u.includes('/functions/v1/translate'))return r.fulfill({contentType:'application/json',body:'{"out":[]}'});
  if(u.includes('/functions/v1/pin-login')){const b=JSON.parse(r.request().postData()||'{}');return b.pin==='1234'?r.fulfill({contentType:'application/json',body:JSON.stringify({access_token:'tok',refresh_token:'r'})}):r.fulfill({status:401,contentType:'application/json',body:'{"error":"bad"}'})}
  if(u.startsWith('https://app.test/')){const f=ROOT+'/'+u.replace('https://app.test/','').split('?')[0];return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'text/javascript':'font/woff2'}):r.fulfill({status:404,body:''})}
  return r.abort()});
 await p.goto('https://app.test/');return {p,ctx,errs}}
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 // admin login by PIN
 let {p,ctx,errs}=await page(b,'admin');
 const seed={docs:[{col:'companies',id:'main',data:{name:'كوانزو',createdAt:1}},{col:'companies',id:'yiwu',data:{name:'ايو',createdAt:2}}]};
 await p.evaluate(s=>{localStorage.setItem('mockdb',s);localStorage.setItem('mocksess','1')},JSON.stringify(seed));await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 await p.evaluate(()=>demoLoad());await p.waitForFunction(()=>S.orders.length>=3);
 await p.evaluate(()=>switchCompany('yiwu'));await p.evaluate(()=>demoLoad());await p.waitForFunction(()=>ACTIVE==='yiwu'&&S.orders.length>=3);
 await p.evaluate(async()=>{const c=S.carriers[0];await put('ctx',{id:'cx1',carrierId:c.id,type:'in',amt:5000,cur:'CNY',paid:1000000,payCur:'IQD',date:todayISO(),status:'wait'})});await p.waitForTimeout(300);
 const store=await p.evaluate(()=>localStorage.getItem('mockdb'));await ctx.close();
 for(const vw of [{width:390,height:844},{width:1366,height:820}]){
 ({p,ctx,errs}=await page(b,'staff',vw));await p.evaluate(s=>localStorage.setItem('mockdb',s),store);await p.reload();
 await p.waitForSelector('#aPin');await p.fill('#aPin','1234');await p.click('#aGo');await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));await p.waitForTimeout(500);
 ok(await p.evaluate(()=>ACTIVE==='yiwu'&&S.companies.length===1&&RAW.orders.filter(o=>o.companyId==='yiwu').length===S.orders.length),'staff sees Yiwu only');
 ok(await p.evaluate(()=>!document.querySelector('[data-act=acct]')),'no account switch for staff');
 const w=vw.width,left=new Set();
 const scan=async()=>{(await p.evaluate(()=>{const out=[];const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=tw.nextNode()){const el=n.parentElement;if(!el||el.closest('script,style,[hidden]'))continue;if(el.offsetParent===null&&getComputedStyle(el).position!=='fixed')continue;const m=n.nodeValue.match(/[؀-ۿ][؀-ۿ\s]*/g);if(m)m.forEach(x=>out.push(x.trim()))}document.querySelectorAll('[placeholder],[aria-label]').forEach(e=>{['placeholder','aria-label'].forEach(a=>{const v=e.getAttribute(a);if(v&&/[؀-ۿ]/.test(v))out.push('@'+v)})});return out})).forEach(x=>left.add(x))};
 const shots=[['home',()=>go('home')],['orders',()=>go('orders')],['order',()=>{go('orders');openOrder(S.orders[0].id)}],['oform',()=>{closeModal(true);go('orders');orderForm()}],['wallet-in',()=>{closeModal(true);go('home');walletForm('in')}],['wallet-pay',()=>{closeModal(true);walletForm('pay')}],['ships',()=>{closeModal(true);go('shipments')}],['factories',()=>go('factories')],['accounts',()=>go('companies')],['activity',()=>go('activity')],['backup',()=>go('backup')]];
 for(const [n,f] of shots){await p.evaluate(f);await p.waitForTimeout(450);await scan();await p.screenshot({path:''+OUT+'/Z-'+w+'-'+n+'.png'})}
 console.log('LEFT',w,JSON.stringify([...left]));
 ok(errs.length===0,'js errors '+errs.join('|'));await ctx.close()}
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
