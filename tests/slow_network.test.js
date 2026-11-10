// Blocked/hanging database (e.g. Supabase from China without VPN): after 10s the grey cards must turn
// into a clear message with a retry button; when data arrives the normal page comes back.
const ROOT=require('path').resolve(__dirname,'..');
const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');
const html=fs.readFileSync(ROOT+'/index.html','utf8'),mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
async function page(b,role){const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u==='https://app.test/')return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
  if(u.endsWith('/lib/supabase.min.js'))return r.fulfill({contentType:'text/javascript',body:'window.__ROLE="'+role+'";'+mock});
  if(u.startsWith('https://app.test/')){const f=ROOT+'/'+u.replace('https://app.test/','').split('?')[0];return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'text/javascript':'font/woff2'}):r.fulfill({status:404,body:''})}
  return r.abort()});
 await p.goto('https://app.test/');return {p,ctx,errs}}
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 for(const role of ['admin','staff']){
  const {p,errs}=await page(b,role);
  await p.evaluate(()=>{localStorage.setItem('mocksess','1');localStorage.setItem('mockhang','1')});await p.reload();
  await p.waitForTimeout(3000);
  ok(await p.evaluate(()=>!!document.querySelector('#view .skel')),role+': grey cards while loading');
  await p.waitForTimeout(8500);
  const txt=await p.evaluate(()=>document.querySelector('#view').innerText);
  ok(!!(await p.$('#view [data-act="reload"]')),role+': retry button shown after 10s');
  ok(role==='admin'?/VPN/.test(txt)&&/ما اكدر أوصل/.test(txt):/无法连接服务器/.test(txt)&&/重试/.test(txt),role+': message text '+txt);
  await p.screenshot({path:require('os').tmpdir()+'/slow_'+role+'.png'});
  // network back -> retry reloads and the normal page appears
  await p.evaluate(()=>localStorage.removeItem('mockhang'));
  await Promise.all([p.waitForNavigation(),p.click('#view [data-act="reload"]')]);
  await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]),null,{timeout:8000});
  ok(await p.evaluate(()=>!document.querySelector('#view .skel')&&!document.querySelector('#view [data-act="reload"]')),role+': normal page after retry');
  ok(errs.length===0,role+': js errors '+errs.join('|'));
 }
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
