import { db } from "../../../../../lib/db";
import { authorize } from "../../../../../lib/security";
import { response, failure, preflight } from "../../../../../lib/http";
export const OPTIONS = preflight;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authorize(request, true);
    const { id } = await params;
    const key = request.headers.get("Idempotency-Key");
    if (!/^\d+$/.test(id) || !key || key.length < 8 || key.length > 100)
      return response(
        request,
        { error: "Identifiant ou clé idempotente invalide" },
        400,
      );
    await db().execute("CALL validate_document(?,?,?)", [id, user.id, key]);
    return response(request, { ok: true });
  } catch (e) {
    return failure(request, e);
  }
}
