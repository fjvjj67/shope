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
 for(const vw of [{width:390,height:844},{width:1366,height:820}]){
 let {p,ctx,errs}=await page(b,'admin',vw);
 const seed={docs:[{col:'companies',id:'main',data:{name:'كوانزو',createdAt:1}},{col:'companies',id:'yiwu',data:{name:'ايو',createdAt:2}}]};
 await p.evaluate(s=>{localStorage.setItem('mockdb',s);localStorage.setItem('mocksess','1')},JSON.stringify(seed));await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 await p.evaluate(()=>demoLoad());await p.waitForFunction(()=>S.orders.length>=3);
 await p.evaluate(()=>go('backup'));await p.waitForTimeout(200);
 await p.click('[data-act=ui-theme][data-v=light]');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.documentElement.dataset.ui==='light'&&localStorage.getItem('ts_ui')==='light'),'light on');
 const w=vw.width;await p.screenshot({path:''+OUT+'/L-'+w+'-backup.png'});
 await p.reload();await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 ok(await p.evaluate(()=>document.documentElement.dataset.ui==='light'),'light remembered after reload');
 for(const v of ['home','orders','shipments']){await p.evaluate(v=>go(v),v);await p.waitForTimeout(350);await p.screenshot({path:''+OUT+'/L-'+w+'-'+v+'.png',fullPage:v==='home'&&w<500})}
 await p.evaluate(()=>{go('home');walletForm('in')});await p.waitForTimeout(300);await p.screenshot({path:''+OUT+'/L-'+w+'-form.png'});await p.evaluate(()=>closeModal(true));
 await p.evaluate(()=>go('backup'));await p.click('[data-act=ui-theme][data-v=dark]');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!document.documentElement.dataset.ui),'back to dark');
 ok(errs.length===0,'js errors '+errs.join('|'));await ctx.close()}
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
