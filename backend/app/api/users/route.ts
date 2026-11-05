import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "../../../lib/db";
import { db } from "../../../lib/db";
import { administrator, hashPassword } from "../../../lib/security";
import { response, failure, preflight } from "../../../lib/http";
export const OPTIONS = preflight;
const schema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100),
  email: z.email().max(190),
  role: z.enum(["admin", "manager"]),
  active: z.boolean(),
  password: z.string().min(12).max(256).optional(),
});
export async function GET(request: Request) {
  try {
    await administrator(request);
    const [rows] = await db().query(
      "SELECT id,name,email,role,active FROM users ORDER BY name,id",
    );
    return response(request, rows);
  } catch (e) {
    return failure(request, e);
  }
}
export async function POST(request: Request) {
  return save(request, false);
}
export async function PUT(request: Request) {
  return save(request, true);
}
async function save(request: Request, update: boolean) {
  let connection;
  try {
    const actor = await administrator(request);
    const parsed = schema.safeParse(await request.json());
    if (
      !parsed.success ||
      (!update && !parsed.data.password) ||
      (update && !parsed.data.id)
    )
      return response(
        request,
        {
          error:
            "Nom, e-mail, rôle et mot de passe (12 caractères minimum) requis.",
        },
        400,
      );
    const p = parsed.data;
    connection = await db().getConnection();
    await connection.beginTransaction();
    const [admins] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role='admin' AND active=1 ORDER BY id FOR UPDATE",
    );
    if (update) {
      const id = p.id!;
      const [current] = await connection.execute<RowDataPacket[]>(
        "SELECT id,role,active FROM users WHERE id=? FOR UPDATE",
        [id],
      );
      if (!current[0]) throw Error("NOT_FOUND");
      if (
        current[0].role === "admin" &&
        current[0].active &&
        (!p.active || p.role !== "admin") &&
        admins.length <= 1
      ) {
        await connection.rollback();
        return response(
          request,
          { error: "Conservez au moins un administrateur actif." },
          409,
        );
      }
      await connection.execute(
        "UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?",
        [p.name, p.email, p.role, p.active, id],
      );
      if (p.password)
        await connection.execute(
          "UPDATE users SET password_hash=? WHERE id=?",
          [hashPassword(p.password), id],
        );
      await connection.execute("DELETE FROM sessions WHERE user_id=?", [id]);
    } else {
      const [r] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users(name,email,role,active,password_hash) VALUES(?,?,?,?,?)",
        [p.name, p.email, p.role, p.active, hashPassword(p.password!)],
      );
      p.id = r.insertId;
    }
    await connection.execute("INSERT INTO audit(user_id,action) VALUES(?,?)", [
      actor.id,
      `user:${update ? "update" : "create"}:${p.id}`,
    ]);
    await connection.commit();
    return response(request, { id: p.id }, update ? 200 : 201);
  } catch (e) {
    await connection?.rollback();
    return failure(request, e);
  } finally {
    connection?.release();
  }
}
