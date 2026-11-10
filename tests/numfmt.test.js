// Number fields: commas appear while typing (10000 → 10,000), saved value is the plain number.
const ROOT=require('path').resolve(__dirname,'..');
const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');
const html=fs.readFileSync(ROOT+'/index.html','utf8'),mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u==='https://app.test/')return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
  if(u.endsWith('/lib/supabase.min.js'))return r.fulfill({contentType:'text/javascript',body:'window.__ROLE="admin";'+mock});
  if(u.startsWith('https://app.test/')){const f=ROOT+'/'+u.replace('https://app.test/','').split('?')[0];return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:/\.css$/.test(f)?'text/css':/\.js$/.test(f)?'text/javascript':'font/woff2'}):r.fulfill({status:404,body:''})}
  return r.abort()});
 await p.goto('https://app.test/');await p.evaluate(()=>{localStorage.setItem('mocksess','1');localStorage.setItem('mockdb',JSON.stringify({docs:[{col:'carriers',id:'c1',data:{name:'شركة',companyId:'main',createdAt:1}}]}))});await p.reload();
 await p.waitForFunction(()=>typeof LOADS!=='undefined'&&LOADS.every(c=>loaded[c]));
 ok(await p.evaluate(()=>[fmtIn('10000'),fmtIn('1234567.5'),fmtIn('١٢٣٤٥'),fmtIn('0012'),fmtIn('1.'),fmtIn('abc'),fmtIn(122148)].join('|'))==='10,000|1,234,567.5|12,345|12|1.|'+'|122,148','fmtIn cases');
 await p.evaluate(()=>{go('home');walletForm('in')});await p.waitForSelector('#f_wAmt');
 await p.click('#f_wPaid');await p.keyboard.type('19000000');ok(await p.inputValue('#f_wPaid')==='19,000,000','typed 19000000 → 19,000,000');
 await p.click('#f_wAmt');await p.keyboard.type('100000');ok(await p.inputValue('#f_wAmt')==='100,000','typed 100000 → 100,000');
 // edit in the middle keeps the cursor
 await p.evaluate(()=>{const i=document.querySelector('#f_wAmt');i.setSelectionRange(1,1)});await p.keyboard.type('5');
 ok(await p.inputValue('#f_wAmt')==='1,500,000','insert in middle → 1,500,000');
 await p.keyboard.press('Backspace');ok(await p.inputValue('#f_wAmt')==='100,000','backspace → 100,000');
 ok(/190/.test(await p.textContent('#wHint')),'hint reads formatted numbers');
 await p.click('.modal .mf .btn[type=submit]');await p.waitForFunction(()=>S.ctx.length===1);
 ok(await p.evaluate(()=>S.ctx[0].paid===19000000&&S.ctx[0].amt===100000),'saved plain numbers');
 ok(await p.evaluate(()=>document.querySelector('#f_wAmt')===null),'form closed');
 ok(errs.length===0,'js errors '+errs.join('|'));
 await b.close();console.log('PASS',pass,'FAIL',fail)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
