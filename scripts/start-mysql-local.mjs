import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {binary,args}=JSON.parse(await readFile('.local/mysql-runtime.json','utf8'));
const child=spawn(binary,args,{windowsHide:true,detached:true,stdio:'ignore'});child.on('error',console.error);child.unref();
console.log('Démarrage de MySQL local demandé sur 127.0.0.1:3307.');
