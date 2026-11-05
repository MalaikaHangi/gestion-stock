import { db } from "../../../lib/db";
import { authorize } from "../../../lib/security";
import { response, failure, preflight } from "../../../lib/http";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  try {
    await authorize(request);
    const p = new URL(request.url).searchParams;
    const from = p.get("from") || "1970-01-01";
    const to = p.get("to") || new Date().toISOString().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from > to
    )
      return response(request, { error: "Période invalide." }, 400);
    const warehouse = p.get("warehouse_id");
    if (warehouse && !/^\d+$/.test(warehouse))
      return response(request, { error: "Dépôt invalide." }, 400);
    const [rows] = await db().execute(
      `SELECT p.id,p.sku,p.name,u.name unit,p.minimum,p.cost,COALESCE(SUM(CASE WHEN l.occurred_at<? THEN l.quantity ELSE 0 END),0) opening,COALESCE(SUM(CASE WHEN l.occurred_at>=? AND l.quantity>0 THEN l.quantity ELSE 0 END),0) incoming,COALESCE(SUM(CASE WHEN l.occurred_at>=? AND l.quantity<0 THEN -l.quantity ELSE 0 END),0) outgoing,COALESCE(SUM(l.quantity),0) closing FROM products p JOIN units u ON u.id=p.unit_id LEFT JOIN ledger l ON l.product_id=p.id AND l.occurred_at<(?::date+INTERVAL '1 day') ${warehouse ? "AND l.warehouse_id=?" : ""} GROUP BY p.id,u.name ORDER BY p.name,p.id`,
      [from, from, from, to, ...(warehouse ? [warehouse] : [])],
    );
    return response(request, { items: rows, from, to, timezone: "UTC" });
  } catch (e) {
    return failure(request, e);
  }
}
