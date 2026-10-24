const ROOT=require('path').resolve(__dirname,'..'),OUT=process.env.OUT||require('os').tmpdir();
const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');
let ExcelJS=null;try{ExcelJS=require('exceljs')}catch(e){}
const html=fs.readFileSync(ROOT+'/index.html','utf8'),mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
async function page(b,role,vw){const ctx=await b.newContext({viewport:vw||{width:390,height:844},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>{errs.push(e.message);console.log('STACK',(e.stack||'').split('\n').slice(0,4).join(' | '))});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u==='https://app.test/')return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
  if(u.endsWith('/lib/supabase.min.js'))return r.fulfill({contentType:'text/javascript',body:'window.__ROLE="'+role+'";'+mock});
  if(u.includes('/functions/v1/translate')){const b=JSON.parse(r.request().postData()||'{}');global.TRC=(global.TRC||0)+1;const M={'义乌五金工厂':'مصنع ييوو للعدد','螺丝刀':'مفك براغي','مصنع النور':'光明工厂','مطارق':'锤子'};return r.fulfill({contentType:'application/json',body:JSON.stringify({out:(b.texts||[]).map(t=>M[t]||(b.to==='ar'?'ترجمة':'译文'))})})}
  if(u.includes('/functions/v1/pin-login')){const b=JSON.parse(r.request().postData()||'{}');return b.pin==='1234'?r.fulfill({contentType:'application/json',body:JSON.stringify({access_token:'tok',refresh_token:'r'})}):r.fulfill({status:401,contentType:'application/json',body:'{"error":"bad"}'})}
  if(u.startsWith('https://app.test/')){const f=ROOT+'/'+u.replace('https://app.test/','').split('?')[0];return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'text/javascript':'font/woff2'}):r.fulfill({status:404,body:''})}
  return r.abort()});
 await p.goto('https://app.test/');return {p,ctx,errs}}
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 // admin login by PIN
 // admin writes Arabic in Yiwu; staff writes Chinese
 let {p,ctx,errs}=await page(b,'admin');
 const seed={docs:[{col:'companies',id:'main',data:{name:'كوانزو',createdAt:1}},{col:'companies',id:'yiwu',data:{name:'ايو',createdAt:2}},
  {col:'factories',id:'fa',data:{name:'مصنع النور',companyId:'yiwu',createdAt:1}},
  {col:'factories',id:'fz',data:{name:'义乌五金工厂',companyId:'yiwu',createdAt:2,note:'螺丝刀'}},
  {col:'orders',id:'o1',data:{ref:'PO-7',factoryId:'fa',companyId:'yiwu',currency:'CNY',total:1000,orderDate:'2026-10-01',stage:'making',note:'مطارق',createdAt:1}}]};
 await p.evaluate(s=>{localStorage.setItem('mockdb',s);localStorage.setItem('mocksess','1')},JSON.stringify(seed));await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 await p.evaluate(()=>{switchCompany('yiwu');go('factories')});await p.waitForTimeout(1200);
 let tx=await p.textContent('#view');
 ok(tx.includes('مصنع ييوو للعدد')&&!tx.includes('义乌五金工厂'),'admin sees staff Chinese factory name in Arabic');
 ok(tx.includes('مصنع النور'),'admin Arabic text unchanged');
 ok(await p.evaluate(()=>S.factories.find(f=>f.id==='fz').name==='义乌五金工厂'),'original kept in data');
 const n1=global.TRC;await p.evaluate(()=>{go('home');go('factories')});await p.waitForTimeout(800);ok(global.TRC===n1,'cached: no new requests on re-render');
 // switch off -> originals
 await p.evaluate(()=>go('backup'));await p.click('[data-act=ct-auto][data-v="0"]');await p.evaluate(()=>go('factories'));await p.waitForTimeout(400);
 ok((await p.textContent('#view')).includes('义乌五金工厂'),'translation off shows original');
 await p.evaluate(()=>go('backup'));await p.click('[data-act=ct-auto][data-v="1"]');
 const store=await p.evaluate(()=>localStorage.getItem('mockdb'));await ctx.close();
 // staff (Chinese screen)
 ({p,ctx,errs}=await page(b,'staff'));await p.evaluate(s=>localStorage.setItem('mockdb',s),store);await p.reload();
 await p.waitForSelector('#aPin');await p.fill('#aPin','1234');await p.click('#aGo');await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 await p.evaluate(()=>go('factories'));await p.waitForTimeout(1200);
 tx=await p.textContent('#view');
 ok(tx.includes('光明工厂')&&!tx.includes('مصنع النور'),'staff sees admin Arabic factory name in Chinese: '+tx.slice(0,200));
 ok(tx.includes('义乌五金工厂'),'staff own Chinese unchanged');
 await p.evaluate(()=>{go('orders');openOrder('o1')});await p.waitForTimeout(1200);
 const mt=await p.textContent('.modal');ok(mt.includes('锤子'),'staff sees Arabic order note in Chinese');
 await p.screenshot({path:''+OUT+'/I-staff-order.png'});
 const left=await p.evaluate(()=>(document.body.innerText.match(/[؀-ۿ]+/g)||[]));console.log('LEFT',JSON.stringify(left.slice(0,30)));
 ok(errs.length===0,'js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
