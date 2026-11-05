import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import path from 'node:path';
const url='https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip';
const entries=JSON.parse(await readFile('.local/mysql-archive-index.json','utf8'));
const selected=entries.filter(e=>!e.name.endsWith('/')&&(/\/bin\/[^/]+\.dll$/i.test(e.name)&&!e.name.includes('-debug')||/\/bin\/(mysqld|mysql|mysqladmin|mysqldump)\.exe$/i.test(e.name)||/\/share\/(english|charsets)\//i.test(e.name)||/\/(LICENSE|README)$/.test(e.name)));
const home=path.join(process.env.LOCALAPPDATA,'StockMaster');await mkdir(home,{recursive:true});
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
async function range(start,end){const r=await fetch(url,{headers:{Range:`bytes=${start}-${end}`}});if(r.status!==206){await r.body.cancel();throw Error('Le serveur ne permet pas le téléchargement partiel');}return Buffer.from(await r.arrayBuffer());}
async function download(e){const target=path.resolve(home,e.name);if(!target.startsWith(home+path.sep))throw Error('Chemin refusé');const existing=await readFile(target).catch(()=>null);if(existing&&existing.length===e.unpacked&&crc32(existing)===e.crc)return;
 const header=await range(e.offset,e.offset+29);const start=e.offset+30+header.readUInt16LE(26)+header.readUInt16LE(28);const compressed=await range(start,start+e.size-1);const buffer=e.method===8?inflateRawSync(compressed):compressed;if(buffer.length!==e.unpacked||crc32(buffer)!==e.crc)throw Error('Contrôle ZIP incorrect : '+e.name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,buffer);console.log('Installé :',path.basename(target));}
let index=0;await Promise.all(Array.from({length:3},async()=>{while(index<selected.length)await download(selected[index++]);}));
await writeFile('.local/mysql-minimal.json',JSON.stringify({url,version:'8.4.13',files:selected.map(e=>({name:e.name,crc:e.crc,size:e.unpacked}))},null,2));
console.log('Installation MySQL minimale téléchargée et contrôlée par CRC ZIP depuis la source officielle.');
