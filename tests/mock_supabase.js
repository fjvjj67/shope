// Fake supabase-js for browser tests: in-memory tables + role enforcement similar to schema.sql
(function(){
const ROLE=window.__ROLE||'admin';
const STAFF_COLS=['factories','orders','payments','carriers','shipments','activity','companies','ledger','files','fchunks','ctx'];
const users={ 'u-admin':{user_id:'u-admin',email:'admin@azawi.app',name:'المدير',role:'admin',created_at:'1'}, 'u-mem':{user_id:'u-mem',email:'staff@azawi.app',name:'الموظف',role:'staff',company:'yiwu',lang:'zh',created_at:'2'}, 'u-new':{user_id:'u-new',email:'x@azawi.app',name:'موقوف',role:'pending',created_at:'3'}};
const me={admin:'u-admin',staff:'u-mem',pending:'u-new'}[ROLE];
const st=JSON.parse(localStorage.getItem('mockdb')||'null')||{docs:[],};
const save=()=>localStorage.setItem('mockdb',JSON.stringify(st));
const role=()=>users[me].role;
const canW=(col)=>role()==='admin'||(role()==='staff'&&STAFF_COLS.includes(col));
let session=localStorage.getItem('mocksess')==='1';
const chans=[];
window.__calls=[];
function q(table){
  const f={eq:[],sel:false,op:null,cnt:false,lim:null,row:null,upd:null};
  const api={
    select(){f.sel=true;return api}, eq(k,v){f.eq.push([k,v]);return api}, limit(n){f.lim=n;return api}, order(){return api}, range(a,b){f.rg=[a,b];return api},
    upsert(r){f.op='upsert';f.row=r;return api}, delete(o){f.op='delete';f.cnt=o&&o.count;return api}, update(u){f.op='update';f.upd=u;return api},
    maybeSingle(){f.single=true;return api},
    then(res,rej){return Promise.resolve(run()).then(res,rej)}
  };
  function match(r){return f.eq.every(([k,v])=>r[k]===v)}
  function run(){
    window.__calls.push(table+':'+(f.op||'select'));
    if(table==='profiles'){
      if(f.op==='update'){ if(role()!=='admin')return {data:null,error:null}; Object.values(users).filter(match).forEach(u=>Object.assign(u,f.upd)); return {data:null,error:null}}
      let rows=Object.values(users).filter(match); if(!['staff','admin'].includes(role()))rows=rows.filter(u=>u.user_id===me);
      return f.single?{data:rows[0]||null,error:null}:{data:rows,error:null};
    }
    if(!['staff','admin'].includes(role())&&f.op!=='upsert')return {data:[],error:null,count:0};
    if(f.op==='upsert'){const r=f.row; if(!canW(r.col))return {error:{message:'rls'}}; const i=st.docs.findIndex(d=>d.col===r.col&&d.id===r.id); if(i>=0)st.docs[i]=r; else st.docs.push(r); save(); notify('UPDATE',r); return {error:null}}
    if(f.op==='delete'){ if(role()!=='admin')return {error:null,count:0}; const before=st.docs.length; const gone=st.docs.filter(match); st.docs=st.docs.filter(d=>!match(d)); save(); gone.forEach(g=>notify('DELETE',g)); return {error:null,count:gone.length}}
    let rows=st.docs.filter(match).map(d=>({id:d.id,data:d.data}));if(f.rg)rows=rows.slice(f.rg[0],f.rg[1]+1);window.__pages=(window.__pages||0)+1;return f.single?{data:rows[0]||null,error:null}:{data:rows,error:null};
  }
  return api;
}
function notify(ev,r){chans.forEach(c=>c.cb({eventType:ev,new:ev==='DELETE'?{}:r,old:ev==='DELETE'?r:{}}))}
window.supabase={createClient(){return {
  from:q,
  channel(){const c={on(_a,_b,cb){c.cb=cb;return c},subscribe(f){chans.push(c);setTimeout(()=>f&&f('SUBSCRIBED'),0);return c}};return c},
  auth:{
    getSession:async()=>({data:{session:session?{user:{id:me,email:users[me].email}}:null}}),
    setSession:async({access_token})=>{ if(access_token==='tok'){session=true;localStorage.setItem('mocksess','1');return {data:{user:{id:me,email:users[me].email}},error:null}} return {data:null,error:{message:'bad'}}},
    signInWithPassword:async({email,password})=>{ if(password==='good'){session=true;localStorage.setItem('mocksess','1');return {data:{user:{id:me,email:users[me].email}},error:null}} return {data:null,error:{message:'bad'}}},
    signOut:async()=>{session=false;localStorage.removeItem('mocksess')}
  }
}}};
})();
