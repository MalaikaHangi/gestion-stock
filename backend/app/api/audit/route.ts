import { db } from "../../../lib/db";
import { administrator } from "../../../lib/security";
import { response, failure, preflight } from "../../../lib/http";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  try {
    await administrator(request);
    const page = Math.max(
      1,
      Math.floor(Number(new URL(request.url).searchParams.get("page")) || 1),
    );
    const [items] = await db().query(
      `SELECT a.*,u.name author,d.reference FROM audit a JOIN users u ON u.id=a.user_id LEFT JOIN documents d ON d.id=a.document_id ORDER BY a.created_at DESC,a.id DESC LIMIT 50 OFFSET ${Math.min(page - 1, 100000) * 50}`,
    );
    return response(request, items);
  } catch (e) {
    return failure(request, e);
  }
}
