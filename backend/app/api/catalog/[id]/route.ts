import type { ResultSetHeader } from "mysql2";
import { db } from "../../../../lib/db";
import { administrator } from "../../../../lib/security";
import { productSchema } from "../../../../lib/validation";
import { response, failure, preflight } from "../../../../lib/http";
export const OPTIONS = preflight;
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await administrator(request);
    const { id } = await params;
    const p = productSchema.safeParse(await request.json());
    if (!/^\d+$/.test(id) || !p.success)
      return response(request, { error: "Produit invalide." }, 400);
    const v = p.data;
    const [r] = await db().execute<ResultSetHeader>(
      "UPDATE products SET sku=?,name=?,category_id=?,unit_id=?,minimum=?,cost=?,barcode=?,active=? WHERE id=?",
      [
        v.sku,
        v.name,
        v.category_id,
        v.unit_id,
        v.minimum,
        v.cost,
        v.barcode || null,
        v.active,
        id,
      ],
    );
    if (!r.affectedRows) throw Error("NOT_FOUND");
    return response(request, { ok: true });
  } catch (e) {
    return failure(request, e);
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await administrator(request);
    const { id } = await params;
    if (!/^\d+$/.test(id))
      return response(request, { error: "Identifiant invalide" }, 400);
    const [r] = await db().execute<ResultSetHeader>(
      "DELETE FROM products WHERE id=?",
      [id],
    );
    if (!r.affectedRows) throw Error("NOT_FOUND");
    return response(request, { ok: true });
  } catch (e) {
    return failure(request, e);
  }
}
