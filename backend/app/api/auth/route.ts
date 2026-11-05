import { randomBytes } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { db } from '../../../lib/db';
import { digest,verifyPassword } from '../../../lib/security';
import {response,failure,preflight} from '../../../lib/http';
export const OPTIONS=preflight;
export async function POST(request:Request){try{
 const {email,password}=await request.json();if(typeof email!=='string'||typeof password!=='string'||password.length>256)return response(request,{error:'Identifiants invalides'},400);
 const key=digest(email.toLowerCase());await db().execute('INSERT INTO login_attempts (attempt_key,attempts,window_start) VALUES (?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_start<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,1,attempts+1),window_start=IF(window_start<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,UTC_TIMESTAMP(),window_start)',[key]);
 const [attempts]=await db().execute<RowDataPacket[]>('SELECT attempts FROM login_attempts WHERE attempt_key=?',[key]);if(attempts[0].attempts>10)return response(request,{error:'Trop de tentatives. Réessayez dans 15 minutes.'},429);
 const [rows]=await db().execute<RowDataPacket[]>('SELECT * FROM users WHERE email=? AND active=1',[email]);const user=rows[0];if(!user||!verifyPassword(password,user.password_hash))return response(request,{error:'E-mail ou mot de passe incorrect'},401);
 const token=randomBytes(32).toString('hex');await db().execute('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,UTC_TIMESTAMP()+INTERVAL 8 HOUR)',[digest(token),user.id]);await db().execute('DELETE FROM login_attempts WHERE attempt_key=?',[key]);return response(request,{token,user:{id:user.id,name:user.name,role:user.role}});
 }catch(e){return failure(request,e);}}
export async function DELETE(request:Request){try{const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(token)await db().execute('DELETE FROM sessions WHERE token_hash=?',[digest(token)]);return response(request,{ok:true});}catch(e){return failure(request,e);}}
