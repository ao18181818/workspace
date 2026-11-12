import {randomBytes} from 'node:crypto';
import {writeFile,chmod} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const domain=(process.argv[2]||'').trim().toLowerCase();
if(!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)||/^(?:\d+\.){3}\d+$/.test(domain)){
 console.error('Usage: node deploy/aliyun/init-config.mjs your.real.domain');process.exit(1);
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'.env');
const content=`APP_DOMAIN=${domain}\nPOSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nSETUP_KEY=${randomBytes(32).toString('hex')}\n`;
try{await writeFile(output,content,{flag:'wx',mode:0o600});await chmod(output,0o600);console.log('Created private .env with new credentials. Existing configuration is never overwritten.')}catch(e){console.error(e.code==='EEXIST'?'Configuration exists; keep the existing database password and setup key.':'Unable to create private configuration');process.exit(1)}
