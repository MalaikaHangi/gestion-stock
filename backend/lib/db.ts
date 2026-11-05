import mysql from 'mysql2/promise';
const globalDb = globalThis as unknown as { stockPool?: mysql.Pool };
export function db(){
  if(!process.env.MYSQL_URL) throw new Error('MYSQL_URL non configurée');
  return globalDb.stockPool ??= mysql.createPool({uri:process.env.MYSQL_URL,connectionLimit:5,decimalNumbers:false,timezone:'Z',...(process.env.MYSQL_SSL_CA ? {ssl:{ca:process.env.MYSQL_SSL_CA.replace(/\\n/g,'\n'),rejectUnauthorized:true}} : {})});
}
