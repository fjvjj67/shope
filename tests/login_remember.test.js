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
 const seed={docs:[{col:'companies',id:'main',data:{name:'كوانزو',createdAt:1}},{col:'companies',id:'yiwu',data:{name:'ايو',createdAt:2}},{col:'carriers',id:'car-gz',data:{name:'Guangzhou',companyId:'main',createdAt:1}},{col:'carriers',id:'car-yw',data:{name:'Yiwu',companyId:'yiwu',createdAt:2}}]};
 await p.evaluate(s=>localStorage.setItem('mockdb',s),JSON.stringify(seed));await p.reload();
 await p.waitForSelector('#aPin');ok(await p.isChecked('#aRem'),'remember checked by default');
 await p.fill('#aPin','1234');await p.press('#aPin','Enter');await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 ok(await p.evaluate(()=>!!localStorage.getItem('azawi-shope-prof')),'profile cached');
 const t0=Date.now();await p.reload();await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 ok(await p.evaluate(()=>document.getElementById('auth').hidden),'reload: no login screen ('+(Date.now()-t0)+'ms)');
 const sw=await p.$$eval('[data-act=acct]',x=>x.map(e=>e.textContent.trim()));ok(sw.some(t=>t.includes('كوانزو'))&&sw.some(t=>t.includes('ايو')),'two accounts in switch: '+sw.join(','));
 await p.click('[data-act=acct][data-id=yiwu] >> visible=true');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>ACTIVE==='yiwu'&&S.carriers.length===1&&S.carriers[0].name==='Yiwu'),'switch to Yiwu shows its carrier');
 await p.screenshot({path:''+OUT+'/rem-yiwu.png'});
 // logout -> login screen, cache cleared
 await p.evaluate(()=>logout());await p.waitForSelector('#aPin');ok(await p.evaluate(()=>!localStorage.getItem('azawi-shope-prof')),'logout clears cache');
 ok(errs.length===0,'js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
