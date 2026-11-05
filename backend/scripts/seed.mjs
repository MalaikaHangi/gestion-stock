import mysql from 'mysql2/promise';
import {randomBytes,scryptSync} from 'node:crypto';
if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<12)throw new Error('Définissez ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères minimum).');
const db=await mysql.createConnection({uri:process.env.MYSQL_URL,multipleStatements:true});const salt=randomBytes(16).toString('hex');
try{await db.execute('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)',['Administrateur',process.env.ADMIN_EMAIL,salt+':'+scryptSync(process.env.ADMIN_PASSWORD,salt,64).toString('hex'),'admin']);
await db.query("INSERT INTO categories(name) VALUES ('Pièces mécaniques'),('Électricité'),('Consommables'); INSERT INTO units(name) VALUES ('Pièce'),('Litre'); INSERT INTO warehouses(name) VALUES ('Dépôt principal'),('Atelier'); INSERT INTO products(sku,name,category_id,unit_id,minimum,cost) VALUES ('MEC-001','Roulement SKF 6205',1,1,20,18.5),('ELE-002','Disjoncteur Schneider 16A',2,1,10,32),('CON-003','Huile hydraulique ISO 46',3,2,50,8.9)");
}finally{await db.end();}
