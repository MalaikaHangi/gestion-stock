import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "../../../lib/db";
import { authorize, digest } from "../../../lib/security";
import { movementSchema } from "../../../lib/validation";
import { checkReferences } from "../../../lib/movements";
import { response, failure, preflight } from "../../../lib/http";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  try {
    await authorize(request);
    const params = new URL(request.url).searchParams;
    const conditions = ["1=1"];
    const args: string[] = [];
    for (const [param, column] of [
      ["kind", "d.kind"],
      ["status", "d.status"],
    ]) {
      if (params.get(param)) {
        conditions.push(column + "=?");
        args.push(params.get(param)!);
      }
    }
    if (params.get("warehouse_id")) {
      conditions.push(
        "(d.warehouse_id=? OR d.destination_id=? OR EXISTS(SELECT 1 FROM ledger sl WHERE sl.document_id=d.id AND sl.warehouse_id=?))",
      );
      args.push(...Array(3).fill(params.get("warehouse_id")!));
    }
    if (params.get("q")) {
      conditions.push(
        "(d.reference LIKE ? OR d.reason LIKE ? OR d.external_reference LIKE ? OR EXISTS(SELECT 1 FROM document_lines dl JOIN products p ON p.id=dl.product_id WHERE dl.document_id=d.id AND (p.name LIKE ? OR p.sku LIKE ?)))",
      );
      args.push(...Array(5).fill("%" + params.get("q") + "%"));
    }
    for (const key of ["from", "to"])
      if (params.get(key)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(params.get(key)!))
          return response(request, { error: "Date invalide" }, 400);
        conditions.push(
          key === "from"
            ? "d.created_at>=?"
            : "d.created_at<DATE_ADD(?,INTERVAL 1 DAY)",
        );
        args.push(params.get(key)!);
      }
    const page = Math.floor(
      Math.max(1, Math.min(100000, Number(params.get("page")) || 1)),
    );
    const size = 25;
    const where = conditions.join(" AND ");
    const [count] = await db().execute<RowDataPacket[]>(
      "SELECT COUNT(*) total FROM documents d WHERE " + where,
      args,
    );
    const [rows] = await db().query(
      `SELECT d.*,w.name warehouse,dw.name destination,u.name author,r.reference reversed_by,(SELECT COUNT(*) FROM document_lines l WHERE l.document_id=d.id) line_count FROM documents d JOIN warehouses w ON w.id=d.warehouse_id LEFT JOIN warehouses dw ON dw.id=d.destination_id JOIN users u ON u.id=d.author_id LEFT JOIN documents r ON r.reversal_of=d.id WHERE ${where} ORDER BY d.created_at DESC,d.id DESC LIMIT ${size} OFFSET ${Math.floor((page - 1) * size)}`,
      args,
    );
    return response(request, {
      items: rows,
      total: Number(count[0].total),
      page,
      size,
    });
  } catch (e) {
    return failure(request, e);
  }
}
export async function POST(request: Request) {
  let connection;
  try {
    const user = await authorize(request, true);
    const parsed = movementSchema.safeParse(await request.json());
    if (!parsed.success)
      return response(
        request,
        {
          error:
            "Vérifiez le motif, les dépôts et les quantités positives. Un article ne doit figurer qu’une fois.",
        },
        400,
      );
    const p = parsed.data;
    const supplied = request.headers.get("Idempotency-Key");
    if (!supplied || supplied.length < 8 || supplied.length > 70)
      return response(request, { error: "Clé idempotente requise." }, 400);
    const key = user.id + ":" + supplied;
    const hash = digest(JSON.stringify(p));
    connection = await db().getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.execute<RowDataPacket[]>(
      "SELECT id,request_hash FROM documents WHERE request_key=?",
      [key],
    );
    if (existing[0]) {
      await connection.rollback();
      return existing[0].request_hash === hash
        ? response(request, { id: existing[0].id })
        : response(
            request,
            { error: "Cette clé correspond à un autre mouvement." },
            409,
          );
    }
    try {
      await checkReferences(connection, p);
    } catch {
      await connection.rollback();
      return response(
        request,
        {
          error: "Un article, partenaire ou dépôt est inactif ou introuvable.",
        },
        409,
      );
    }
    const [r] = await connection.execute<ResultSetHeader>(
      "INSERT INTO documents(kind,warehouse_id,destination_id,partner_id,external_reference,reason,author_id,request_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        p.kind,
        p.warehouse_id,
        p.destination_id ?? null,
        p.partner_id ?? null,
        p.external_reference,
        p.reason,
        user.id,
        key,
        hash,
      ],
    );
    for (const l of p.lines)
      await connection.execute(
        "INSERT INTO document_lines(document_id,product_id,quantity,unit_cost) VALUES(?,?,?,?)",
        [r.insertId, l.product_id, l.quantity, l.unit_cost ?? null],
      );
    await connection.execute(
      "INSERT INTO audit(user_id,action,document_id) VALUES(?,?,?)",
      [user.id, "draft:create", r.insertId],
    );
    await connection.commit();
    return response(request, { id: r.insertId }, 201);
  } catch (e) {
    await connection?.rollback();
    return failure(request, e);
  } finally {
    connection?.release();
  }
}
