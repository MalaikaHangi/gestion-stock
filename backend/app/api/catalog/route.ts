import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { productSchema } from "../../../lib/validation";
import { db } from "../../../lib/db";
import { authorize, administrator } from "../../../lib/security";
import { response, failure, preflight } from "../../../lib/http";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  try {
    const user = await authorize(request);
    const all =
      user.role === "admin" &&
      new URL(request.url).searchParams.get("all") === "1";
    const [products] = await db().query<RowDataPacket[]>(
      `SELECT p.*,c.name category,u.name unit,COALESCE(SUM(b.quantity),0) quantity FROM products p JOIN categories c ON c.id=p.category_id JOIN units u ON u.id=p.unit_id LEFT JOIN stock_balances b ON b.product_id=p.id ${all ? "" : "WHERE p.active=1"} GROUP BY p.id ORDER BY p.name,p.id`,
    );
    const [warehouses] = await db().query(
      "SELECT * FROM warehouses" + (all ? "" : " WHERE active=1"),
    );
    const [categories] = await db().query(
      "SELECT * FROM categories" + (all ? "" : " WHERE active=1"),
    );
    const [units] = await db().query("SELECT * FROM units");
    const [partners] = await db().query(
      "SELECT * FROM partners" + (all ? "" : " WHERE active=1"),
    );
    const [balances] = await db().query("SELECT * FROM stock_balances");
    return response(request, {
      products,
      warehouses,
      categories,
      units,
      partners,
      balances,
      syncedAt: new Date().toISOString(),
    });
  } catch (e) {
    return failure(request, e);
  }
}
export async function POST(request: Request) {
  try {
    await administrator(request);
    const parsed = productSchema.safeParse(await request.json());
    if (!parsed.success)
      return response(
        request,
        { error: "Vérifiez les champs du produit." },
        400,
      );
    const p = parsed.data;
    const [r] = await db().execute<ResultSetHeader>(
      "INSERT INTO products(sku,name,category_id,unit_id,minimum,cost,barcode,active) VALUES(?,?,?,?,?,?,?,?)",
      [
        p.sku,
        p.name,
        p.category_id,
        p.unit_id,
        p.minimum,
        p.cost,
        p.barcode || null,
        p.active,
      ],
    );
    return response(request, { id: r.insertId }, 201);
  } catch (e) {
    return failure(request, e);
  }
}
