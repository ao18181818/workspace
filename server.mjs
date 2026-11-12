import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes, createHash, scrypt as rawScrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt), prod=process.env.NODE_ENV==='production';
if(prod && (!process.env.DATABASE_URL || !process.env.SETUP_KEY)) throw Error('DATABASE_URL and SETUP_KEY required');
let query;
if(process.env.DATABASE_URL){
 const {Pool}=await import('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5});
 query=(sql,args=[])=>pool.query(sql,args);
}else{
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(process.env.LOCAL_DB||'local.sqlite');
 query=async(sql,args=[])=>{const params=[];sql=sql.replace(/\$(\d+)/g,(_,n)=>{params.push(args[Number(n)-1]);return '?'});const s=db.prepare(sql);if(/^\s*(SELECT|UPDATE.*RETURNING)/is.test(sql)) {const rows=s.all(...params);return {rows,rowCount:rows.length}}const r=s.run(...params);return {rows:[],rowCount:Number(r.changes)}};
}
await query('CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password TEXT NOT NULL)');
await query('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires BIGINT NOT NULL)');
await query('CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)');
const defaults={categories:[{id:'work',name:'创作工具'},{id:'read',name:'阅读与参考'}],bookmarks:[{id:'b1',title:'小红书创作服务平台',url:'https://creator.xiaohongshu.com/',category:'work'},{id:'b2',title:'抖音创作者中心',url:'https://creator.douyin.com/',category:'work'},{id:'b3',title:'GitHub',url:'https://github.com/',category:'read'}],cards:[],engines:[{id:'baidu',name:'百度',url:'https://www.baidu.com/s?wd={q}'},{id:'google',name:'谷歌',url:'https://www.google.com/search?q={q}'},{id:'bing',name:'必应',url:'https://www.bing.com/search?q={q}'}],settings:{name:'南西',engine:'baidu',showCards:true,showClock:true,newTab:true,theme:'light'}};
await query('INSERT INTO workspace (id,version,data) VALUES (1,0,$1) ON CONFLICT(id) DO NOTHING',[JSON.stringify(defaults)]);
const hash=v=>createHash('sha256').update(v).digest('hex');
async function passwordHash(p){const salt=randomBytes(16).toString('hex');return salt+':'+Buffer.from(await scrypt(p,salt,64)).toString('hex')}
async function passwordMatch(p,stored){const [salt,digest]=stored.split(':');return timingSafeEqual(Buffer.from(await scrypt(p,salt,64)),Buffer.from(digest,'hex'))}
function safeEqual(a,b){return timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)))}
function validate(d){
 if(!d||!Array.isArray(d.categories)||!Array.isArray(d.bookmarks)||!Array.isArray(d.cards)||!Array.isArray(d.engines)||!d.settings) return false;
 const text=(x,n)=>typeof x==='string'&&x.length<=n;
 const unique=a=>a.length<=2000&&a.every(x=>x&&text(x.id,80)&&x.id.length)&&new Set(a.map(x=>x.id)).size===a.length;
 const url=u=>{try{return ['https:','http:'].includes(new URL(u.replace('{q}','test')).protocol)}catch{return false}};
 return [d.categories,d.bookmarks,d.cards,d.engines].every(unique)&&d.engines.length>0&&d.engines.length<=30&&d.categories.every(c=>text(c.name,80)&&c.name.trim())&&d.bookmarks.every(b=>text(b.title,200)&&text(b.url,2048)&&url(b.url)&&d.categories.some(c=>c.id===b.category))&&d.cards.every(c=>text(c.title,200)&&text(c.body,20000)&&['note','todo'].includes(c.type)&&typeof c.done==='boolean'&&text(c.due,10)&&(!c.due||/^\d{4}-\d{2}-\d{2}$/.test(c.due))&&['paper','sage','sand'].includes(c.color))&&d.engines.every(e=>text(e.name,80)&&text(e.url,2048)&&e.url.includes('{q}')&&url(e.url))&&text(d.settings.name,80)&&d.engines.some(e=>e.id===d.settings.engine)&&['light','dark'].includes(d.settings.theme)&&['showClock','showCards','newTab'].every(k=>typeof d.settings[k]==='boolean');
}
const attempts=new Map();
const server=http.createServer(async(req,res)=>{
 const send=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))};
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 if(prod)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&path==='/health'){await query('SELECT id FROM workspace WHERE id=1');return send(200,{ok:true})}
 if(path.startsWith('/api/')){
  if(!['GET','POST','PUT'].includes(req.method))return send(405,{error:'不支持此操作'});
  if(req.method!=='GET'){
   const origin=req.headers.origin,expected=`${prod?'https':'http'}://${req.headers.host}`;
   if(origin!==expected||req.headers['x-requested-with']!=='NanxiStart')return send(403,{error:'请求来源无效'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'需要 JSON 数据'});
  }
  const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')));
  const session=cookies.session&&await query('SELECT token FROM sessions WHERE token=$1 AND expires>$2',[hash(cookies.session),Date.now()]);
  const authed=!!session?.rows.length;
  if(path==='/api/status'&&req.method==='GET'){const o=await query('SELECT id FROM owner WHERE id=1');return send(200,{initialized:!!o.rows.length,authenticated:authed})}
  let body={};if(req.method!=='GET'){
   let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>2_000_000){return send(413,{error:'数据过大，请减少卡片数量'})}}try{body=JSON.parse(raw)}catch{return send(400,{error:'数据格式错误'})}
  }
  if(['/api/login','/api/setup'].includes(path)&&req.method==='POST'){
   const ip=req.socket.remoteAddress;const now=Date.now();
   for(const [key,v] of attempts)if(now-v.at>900000)attempts.delete(key);
   const rate=attempts.get(ip)||{at:now,count:0};rate.count++;attempts.set(ip,rate);
   if(rate.count>12)return send(429,{error:'尝试次数过多，请 15 分钟后重试'});
   if(typeof body.email!=='string'||typeof body.password!=='string'||body.password.length>200||body.email.length>254)return send(400,{error:'请填写邮箱和密码'});
   const email=body.email.trim().toLowerCase();let owner=(await query('SELECT * FROM owner WHERE id=1')).rows[0];
   if(path==='/api/setup'){
    if(owner)return send(409,{error:'账户已创建，请登录'});
    if(!safeEqual(String(body.key||''),process.env.SETUP_KEY||'local-development-only'))return send(403,{error:'初始化密钥不正确'});
    if(body.password.length<12||!/^\S+@\S+\.\S+$/.test(email))return send(400,{error:'请输入有效邮箱，密码至少 12 位'});
    const result=await query('INSERT INTO owner (id,email,password) VALUES (1,$1,$2) ON CONFLICT(id) DO NOTHING',[email,await passwordHash(body.password)]);
    if(!result.rowCount)return send(409,{error:'账户已创建，请登录'});
   }else if(!owner||owner.email!==email||!await passwordMatch(body.password,owner.password))return send(401,{error:'邮箱或密码不正确'});
   attempts.delete(ip);const token=randomBytes(32).toString('hex');await query('DELETE FROM sessions WHERE expires<$1',[now]);await query('INSERT INTO sessions (token,expires) VALUES ($1,$2)',[hash(token),now+30*86400000]);
   return send(200,{ok:true},{'Set-Cookie':`session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${prod?'; Secure':''}`});
  }
  if(!authed)return send(401,{error:'请先登录'});
  if(path==='/api/logout'&&req.method==='POST'){await query('DELETE FROM sessions WHERE token=$1',[hash(cookies.session)]);return send(200,{ok:true},{'Set-Cookie':`session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${prod?'; Secure':''}`})}
  if(path==='/api/password'&&req.method==='POST'){
   const o=(await query('SELECT * FROM owner WHERE id=1')).rows[0];
   if(typeof body.current!=='string'||body.current.length>200||typeof body.next!=='string'||body.next.length<12||body.next.length>200)return send(400,{error:'新密码需为 12–200 位'});
   if(!await passwordMatch(body.current,o.password))return send(403,{error:'原密码不正确'});
   await query('UPDATE owner SET password=$1 WHERE id=1',[await passwordHash(body.next)]);await query('DELETE FROM sessions');return send(200,{ok:true});
  }
  if(path==='/api/state'&&req.method==='GET'){const r=(await query('SELECT version,data FROM workspace WHERE id=1')).rows[0];return send(200,{version:r.version,data:JSON.parse(r.data)})}
  if(path==='/api/state'&&req.method==='PUT'){
   if(!Number.isInteger(body.version)||!validate(body.data))return send(400,{error:'内容不符合要求，请检查网址、分类和搜索设置'});
   const r=await query('UPDATE workspace SET data=$1,version=version+1 WHERE id=1 AND version=$2 RETURNING version',[JSON.stringify(body.data),body.version]);
   if(!r.rows.length)return send(409,{error:'另一台设备已更新内容，本机修改已保留，请先处理同步冲突'});
   return send(200,{version:r.rows[0].version});
  }
  return send(404,{error:'接口不存在'});
 }
 if(req.method!=='GET')return send(405,{error:'不支持此操作'});
 const allowed={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg','/sw.js':'sw.js'};
 if(!allowed[path])return send(404,{error:'页面不存在'});
 const ext=allowed[path].split('.').pop(),mime={html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',svg:'image/svg+xml'}[ext];
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-cache'});res.end(await readFile(new URL('public/'+allowed[path],import.meta.url)));
 }catch(e){console.error('Request failed:',e.code||e.name);if(!res.headersSent)send(500,{error:'服务暂时不可用，本机修改会保留，请稍后重试'});else res.end()}
});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Nanxi Start ready'));
