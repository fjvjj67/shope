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
 const docs=[{col:'companies',id:'main',data:{name:'كوانزو',createdAt:1}}];for(let i=0;i<2345;i++)docs.push({col:'factories',id:'f'+String(i).padStart(5,'0'),data:{name:'F'+i,companyId:'main',createdAt:i}});
 for(let i=0;i<700;i++)docs.push({col:'activity',id:'a'+i,data:{at:i,by:'u-admin',act:'add',col:'orders',label:'x'+i,companyId:'main'}});
 await p.evaluate(s=>{localStorage.setItem('mockdb',s);localStorage.setItem('mocksess','1')},JSON.stringify({docs}));await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));await p.waitForTimeout(500);
 ok(await p.evaluate(()=>S.factories.length===2345),'2345 factories loaded across pages: '+await p.evaluate(()=>S.factories.length));
 ok(await p.evaluate(()=>ACT.length===150),'activity shows newest 150');
 const before=await p.evaluate(()=>window.__pages);await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});SBDB.refresh()});await p.waitForTimeout(400);
 ok(await p.evaluate(b=>window.__pages>b,before),'refresh re-reads data');
 ok(errs.length===0,'js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
