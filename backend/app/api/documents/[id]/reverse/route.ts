import { z } from "zod";
import { db } from "../../../../../lib/db";
import { administrator } from "../../../../../lib/security";
import { response, failure, preflight } from "../../../../../lib/http";
export const OPTIONS = preflight;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await administrator(request);
    const { id } = await params;
    const key = request.headers.get("Idempotency-Key");
    const parsed = z
      .object({ reason: z.string().trim().min(1).max(255) })
      .safeParse(await request.json());
    if (
      !/^\d+$/.test(id) ||
      !key ||
      key.length < 8 ||
      key.length > 100 ||
      !parsed.success
    )
      return response(
        request,
        { error: "Motif et clé idempotente requis." },
        400,
      );
    await db().execute("CALL reverse_document(?,?,?,?)", [
      id,
      user.id,
      parsed.data.reason,
      key,
    ]);
    return response(request, { ok: true });
  } catch (e) {
    return failure(request, e);
  }
}
