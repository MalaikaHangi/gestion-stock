import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db } from "./db";
import type { RowDataPacket } from "mysql2";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function authorize(request: Request, write = false) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const [rows] = await db().execute<RowDataPacket[]>(
    "SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.active=1",
    [digest(token)],
  );
  if (!rows[0] || !["admin", "manager"].includes(rows[0].role))
    throw new Error("UNAUTHORIZED");
  return rows[0];
}
export async function administrator(request: Request) {
  const user = await authorize(request);
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}
