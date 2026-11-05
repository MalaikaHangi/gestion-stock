import mysql from 'mysql2/promise';
import { readFile,readdir } from 'node:fs/promises';
const connection=await mysql.createConnection({uri:process.env.MYSQL_URL,multipleStatements:true});
try{
 await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
 for(const file of (await readdir(new URL('../../sql/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const [rows]=await connection.execute('SELECT name FROM schema_migrations WHERE name=?',[file]);if(rows.length)continue;
  const sql=await readFile(new URL('../../sql/'+file,import.meta.url),'utf8');
  if(sql.includes('DELIMITER $$')){const body=sql.split('DELIMITER $$')[1].split('DELIMITER ;')[0];for(const statement of body.split('$$').map(s=>s.trim()).filter(Boolean))await connection.query(statement);}
  else await connection.query(sql);
  await connection.execute('INSERT INTO schema_migrations(name) VALUES (?)',[file]);console.log('Migration appliquée :',file);
 }
}finally{await connection.end();}
