import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const env={};for(const line of(await readFile('backend/.env','utf8')).split(/\r?\n/)){const i=line.indexOf('=');if(i>0)env[line.slice(0,i)]=line.slice(i+1);}
const base='http://localhost:3000';
const health=await fetch(base+'/api/health');assert.equal(health.status,200);
const unauthorized=await fetch(base+'/api/catalog');assert.equal(unauthorized.status,401);
const result=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},body:JSON.stringify({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})});assert.equal(result.status,200);assert.equal(result.headers.get('access-control-allow-origin'),'http://localhost:5173');
const {token}=await result.json();assert.ok(token);
const catalog=await fetch(base+'/api/catalog',{headers:{Authorization:'Bearer '+token}});assert.equal(catalog.status,200);const data=await catalog.json();assert.ok(data.products.length>=3);
const logout=await fetch(base+'/api/auth',{method:'DELETE',headers:{Authorization:'Bearer '+token}});assert.equal(logout.status,200);
const expired=await fetch(base+'/api/catalog',{headers:{Authorization:'Bearer '+token}});assert.equal(expired.status,401);
console.log('API locale : santé, authentification, CORS, catalogue et révocation de session vérifiés.');
