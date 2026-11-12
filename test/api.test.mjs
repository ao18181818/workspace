import {test,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';
const dir=await mkdtemp(os.tmpdir()+'/nanxi-test-'),base='http://127.0.0.1:3198';
const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3198',LOCAL_DB:dir+'/test.sqlite',SETUP_KEY:'test-only-setup-secret'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.on('exit',()=>reject(Error('server exited')))});
after(async()=>{child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true})});
let cookie;
async function request(path,method='GET',body,session=cookie,origin=base){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','X-Requested-With':'NanxiStart',...(session?{Cookie:session}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
test('private account, persistent state and conflict protection',async()=>{
 assert.equal((await request('state')).status,401);
 assert.equal((await request('setup','POST',{email:'a@example.com',password:'very-long-password',key:'bad'})).status,403);
 const setup=await request('setup','POST',{email:'a@example.com',password:'very-long-password',key:'test-only-setup-secret'});assert.equal(setup.status,200);cookie=setup.cookie;
 assert.equal((await request('setup','POST',{email:'b@example.com',password:'very-long-password',key:'test-only-setup-secret'})).status,409);
 assert.equal((await request('state','PUT',{},cookie,'https://evil.example')).status,403);
 const first=(await request('state')).data;assert.equal(first.version,0);
 const data=structuredClone(first.data);data.cards.push({id:'t1',title:'test',body:'private',type:'todo',due:'2026-11-20',done:false,color:'sage'});
 const saves=await Promise.all([request('state','PUT',{version:0,data}),request('state','PUT',{version:0,data})]);assert.deepEqual(saves.map(x=>x.status).sort(),[200,409]);
 assert.equal((await request('state')).data.data.cards[0].body,'private');
 const invalid=structuredClone(data);invalid.bookmarks[0].url='javascript:alert(1)';assert.equal((await request('state','PUT',{version:1,data:invalid})).status,400);
 const device=await request('login','POST',{email:'a@example.com',password:'very-long-password'},null);assert.equal(device.status,200);assert.equal((await request('state','GET',undefined,device.cookie)).data.version,1);
 assert.equal((await request('password','POST',{current:'very-long-password',next:'another-long-password'})).status,200);
 assert.equal((await request('state')).status,401);assert.equal((await request('state','GET',undefined,device.cookie)).status,401);
 assert.equal((await request('login','POST',{email:'a@example.com',password:'another-long-password'},null)).status,200);
});
