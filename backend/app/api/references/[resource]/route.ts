import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "../../../../lib/db";
import { administrator } from "../../../../lib/security";
import { response, failure, preflight } from "../../../../lib/http";
export const OPTIONS = preflight;
const tables = new Set([
  "categories",
  "warehouses",
  "units",
  "partners",
  "locations",
]);
const schema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100),
  active: z.boolean().default(true),
  parent_id: z.number().int().positive().nullable().optional(),
  warehouse_id: z.number().int().positive().optional(),
  kind: z.enum(["supplier", "customer"]).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
});
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    await administrator(request);
    const { resource } = await params;
    if (!tables.has(resource)) throw Error("NOT_FOUND");
    const [rows] = await db().query(
      `SELECT * FROM ${resource} ORDER BY name,id`,
    );
    return response(request, rows);
  } catch (e) {
    return failure(request, e);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  return save(request, context, false);
}
export async function PUT(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  return save(request, context, true);
}
async function save(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
  update: boolean,
) {
  let connection;
  try {
    await administrator(request);
    const { resource } = await params;
    if (!tables.has(resource)) throw Error("NOT_FOUND");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || (update && !parsed.data.id))
      return response(request, { error: "Référence invalide." }, 400);
    const p = parsed.data;
    if (
      (resource === "partners" && !p.kind) ||
      (resource === "locations" && !p.warehouse_id)
    )
      return response(
        request,
        { error: "Renseignez les champs obligatoires." },
        400,
      );
    connection = await db().getConnection();
    await connection.beginTransaction();
    const fields: Record<string, unknown> = { name: p.name };
    if (["categories", "warehouses", "partners"].includes(resource))
      fields.active = p.active;
    if (resource === "categories") {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT id,parent_id FROM categories ORDER BY id FOR UPDATE",
      );
      const parents = new Map<number, number | null>(
        rows.map((r) => [
          Number(r.id),
          r.parent_id === null ? null : Number(r.parent_id),
        ]),
      );
      let parent = p.parent_id ?? null;
      const visited = new Set<number>();
      while (parent !== null) {
        if (parent === p.id || visited.has(parent)) {
          await connection.rollback();
          return response(
            request,
            { error: "Une catégorie ne peut pas être son propre ancêtre." },
            409,
          );
        }
        visited.add(parent);
        parent = parents.get(parent) ?? null;
      }
      fields.parent_id = p.parent_id ?? null;
    }
    if (resource === "partners") {
      fields.kind = p.kind;
      fields.email = p.email || null;
    }
    if (resource === "locations") fields.warehouse_id = p.warehouse_id;
    const keys = Object.keys(fields);
    const values = Object.values(fields) as (
      | string
      | number
      | boolean
      | null
    )[];
    let id = p.id;
    if (update) {
      const [r] = await connection.execute<ResultSetHeader>(
        `UPDATE ${resource} SET ${keys.map((k) => k + "=?").join(",")} WHERE id=?`,
        [...values, id!],
      );
      if (!r.affectedRows) throw Error("NOT_FOUND");
    } else {
      const [r] = await connection.execute<ResultSetHeader>(
        `INSERT INTO ${resource} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        values,
      );
      id = r.insertId;
    }
    await connection.commit();
    return response(request, { id }, update ? 200 : 201);
  } catch (e) {
    await connection?.rollback();
    return failure(request, e);
  } finally {
    connection?.release();
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    await administrator(request);
    const { resource } = await params;
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!tables.has(resource) || !/^\d+$/.test(id))
      return response(request, { error: "Référence invalide." }, 400);
    const [r] = await db().execute<ResultSetHeader>(
      `DELETE FROM ${resource} WHERE id=?`,
      [id],
    );
    if (!r.affectedRows) throw Error("NOT_FOUND");
    return response(request, { ok: true });
  } catch (e) {
    return failure(request, e);
  }
}
