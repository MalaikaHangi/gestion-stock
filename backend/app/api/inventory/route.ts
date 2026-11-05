import { z } from "zod";
import { db, type RowDataPacket, type ResultSetHeader } from "../../../lib/db";
import { authorize, administrator, digest } from "../../../lib/security";
import { companyDefaults } from "../../../lib/company";
import { decimal } from "../../../lib/validation";
import { response, failure, preflight } from "../../../lib/http";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  try {
    await authorize(request);
    const [rows] = await db().query(
      "SELECT c.*,p.name,p.sku,u.name author,d.reference FROM stock_counts c JOIN products p ON p.id=c.product_id JOIN users u ON u.id=c.user_id LEFT JOIN documents d ON d.id=c.document_id ORDER BY c.created_at DESC,c.id DESC LIMIT 100",
    );
    return response(request, rows);
  } catch (e) {
    return failure(request, e);
  }
}
const schema = z.object({
  product_id: z.number().int().positive(),
  expected: decimal,
  counted: decimal,
});
export async function POST(request: Request) {
  let c;
  try {
    const user = await administrator(request);
    const parsed = schema.safeParse(await request.json());
    const key = request.headers.get("Idempotency-Key");
    if (!parsed.success || !key || key.length < 8 || key.length > 70)
      return response(
        request,
        { error: "Vérifiez l’article et les quantités comptées." },
        400,
      );
    const p = parsed.data,
      requestKey = user.id + ":" + key,
      hash = digest(JSON.stringify(p));
    const { warehouse } = await companyDefaults();
    c = await db().getConnection();
    await c.beginTransaction();
    await c.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [requestKey]);
    const [old] = await c.execute<RowDataPacket[]>(
      "SELECT * FROM stock_counts WHERE request_key=?",
      [requestKey],
    );
    if (old[0]) {
      await c.rollback();
      return old[0].request_hash === hash
        ? response(request, old[0])
        : response(
            request,
            { error: "Clé déjà utilisée pour un autre comptage." },
            409,
          );
    }
    const [products] = await c.execute<RowDataPacket[]>(
      "SELECT id FROM products WHERE id=? AND active=1 FOR SHARE",
      [p.product_id],
    );
    if (!products.length) throw Error("NOT_FOUND");
    await c.execute(
      "INSERT INTO stock_balances(warehouse_id,product_id,quantity) VALUES(?,?,0) ON CONFLICT DO NOTHING",
      [warehouse, p.product_id],
    );
    const [balances] = await c.execute<RowDataPacket[]>(
      "SELECT quantity,quantity=?::numeric matches,?::numeric-quantity difference FROM stock_balances WHERE warehouse_id=? AND product_id=? FOR UPDATE",
      [p.expected, p.counted, warehouse, p.product_id],
    );
    if (!balances[0].matches) {
      await c.rollback();
      return response(
        request,
        {
          error:
            "Le stock a changé depuis votre lecture. Actualisez puis recomptez.",
        },
        409,
      );
    }
    const difference = String(balances[0].difference);
    let documentId: number | null = null;
    if (Number(difference) !== 0) {
      const [d] = await c.execute<ResultSetHeader>(
        "INSERT INTO documents(kind,warehouse_id,reason,author_id) VALUES(?,?,'Correction après comptage physique',?)",
        [Number(difference) > 0 ? "IN" : "OUT", warehouse, user.id],
      );
      documentId = d.insertId;
      await c.execute(
        "INSERT INTO document_lines(document_id,product_id,quantity) VALUES(?,?,abs(?::numeric))",
        [documentId, p.product_id, difference],
      );
      await c.execute("SELECT validate_document(?,?,?)", [
        documentId,
        user.id,
        "count-" + requestKey,
      ]);
    }
    const [result] = await c.execute<ResultSetHeader>(
      "INSERT INTO stock_counts(product_id,expected,counted,difference,document_id,user_id,request_key,request_hash) VALUES(?,?,?,?,?,?,?,?)",
      [
        p.product_id,
        p.expected,
        p.counted,
        difference,
        documentId,
        user.id,
        requestKey,
        hash,
      ],
    );
    await c.execute(
      "INSERT INTO audit(user_id,action,document_id) VALUES(?,'inventory:count',?)",
      [user.id, documentId],
    );
    await c.commit();
    return response(
      request,
      { id: result.insertId, difference, document_id: documentId },
      201,
    );
  } catch (e) {
    await c?.rollback();
    return failure(request, e);
  } finally {
    c?.release();
  }
}
