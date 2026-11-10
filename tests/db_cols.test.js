// Every collection the app writes must be allowed by the real database check constraint docs_col_ok
// (newest supabase/*.sql that defines it), and the fake database in tests must use the same list.
const fs=require('fs'),path=require('path'),ROOT=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const sqls=fs.readdirSync(ROOT+'/supabase').filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
let dbCols=null;for(const f of sqls){const m=fs.readFileSync(ROOT+'/supabase/'+f,'utf8').match(/docs_col_ok check \(col = any \(array\[([^\]]+)\]/);if(m)dbCols=m[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1))}
ok(dbCols,'found docs_col_ok in supabase/*.sql');
const data=fs.readFileSync(ROOT+'/js/data.js','utf8');
const cols=[...data.match(/const COLS = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const scoped=[...data.match(/const SCOPED = \[\.\.\.COLS, ([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const used=[...cols,...scoped,'companies','activity','meta','files','fchunks'];
used.forEach(c=>ok(dbCols.includes(c),'database does not allow collection "'+c+'" — add it to docs_col_ok with a new supabase/NN_*.sql'));
const mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');const mc=mock.match(/const DOC_COLS=\[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
ok(JSON.stringify([...mc].sort())===JSON.stringify([...dbCols].sort()),'mock DOC_COLS equals database list');
console.log('PASS',pass,'FAIL',fail);
