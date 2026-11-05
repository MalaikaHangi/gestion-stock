import { companyMovement } from '../../../../lib/company';
import type { RowDataPacket } from "../../../../lib/db";
import { db } from "../../../../lib/db";
import { authorize } from "../../../../lib/security";
import { movementSchema } from "../../../../lib/validation";
import { checkReferences, documentDetail } from "../../../../lib/movements";
import { response, failure, preflight } from "../../../../lib/http";
export const OPTIONS = preflight;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await authorize(request);
    const { id } = await params;
    if (!/^\d+$/.test(id)) throw Error("NOT_FOUND");
    return response(request, await documentDetail(id));
  } catch (e) {
    return failure(request, e);
  }
}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let connection;
  try {
    const user = await authorize(request, true);
    const { id } = await params;
    const p = movementSchema.safeParse(await companyMovement(await request.json()));
    if (!/^\d+$/.test(id) || !p.success)
      return response(request, { error: "Mouvement invalide." }, 400);
    connection = await db().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT status FROM documents WHERE id=? FOR UPDATE",
      [id],
    );
    if (!rows[0]) throw Error("NOT_FOUND");
    if (rows[0].status !== "draft") {
      await connection.rollback();
      return response(
        request,
        { error: "Seul un brouillon peut être modifié." },
        409,
      );
    }
    try {
      await checkReferences(connection, p.data);
    } catch {
      await connection.rollback();
      return response(
        request,
        { error: "Référence inactive ou introuvable." },
        409,
      );
    }
    const v = p.data;
    await connection.execute(
      "UPDATE documents SET kind=?,warehouse_id=?,destination_id=?,partner_id=?,external_reference=?,reason=? WHERE id=?",
      [
        v.kind,
        v.warehouse_id,
        v.destination_id ?? null,
        v.partner_id ?? null,
        v.external_reference,
        v.reason,
        id,
      ],
    );
    await connection.execute("DELETE FROM document_lines WHERE document_id=?", [
      id,
    ]);
    for (const l of v.lines)
      await connection.execute(
        "INSERT INTO document_lines(document_id,product_id,quantity,unit_cost) VALUES(?,?,?,?)",
        [id, l.product_id, l.quantity, l.unit_cost ?? null],
      );
    await connection.execute(
      "INSERT INTO audit(user_id,action,document_id) VALUES(?,?,?)",
      [user.id, "draft:update", id],
    );
    await connection.commit();
    return response(request, { ok: true });
  } catch (e) {
    await connection?.rollback();
    return failure(request, e);
  } finally {
    connection?.release();
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let connection;
  try {
    const user = await authorize(request, true);
    const { id } = await params;
    if (!/^\d+$/.test(id)) throw Error("NOT_FOUND");
    connection = await db().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT status FROM documents WHERE id=? FOR UPDATE",
      [id],
    );
    if (!rows[0]) throw Error("NOT_FOUND");
    if (rows[0].status !== "draft") {
      await connection.rollback();
      return response(
        request,
        { error: "Seul un brouillon peut être annulé." },
        409,
      );
    }
    await connection.execute(
      "UPDATE documents SET status='cancelled' WHERE id=?",
      [id],
    );
    await connection.execute(
      "INSERT INTO audit(user_id,action,document_id) VALUES(?,?,?)",
      [user.id, "draft:cancel", id],
    );
    await connection.commit();
    return response(request, { ok: true });
  } catch (e) {
    await connection?.rollback();
    return failure(request, e);
  } finally {
    connection?.release();
  }
}
