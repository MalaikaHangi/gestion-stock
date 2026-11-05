import type { PoolConnection, RowDataPacket } from "./db";
import { db } from "./db";
import { movementSchema } from "./validation";
export async function checkReferences(
  connection: PoolConnection,
  p: ReturnType<typeof movementSchema.parse>,
) {
  const warehouseIds = [
    p.warehouse_id,
    ...(p.kind === "TRANSFER" ? [p.destination_id!] : []),
  ];
  const [warehouses] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM warehouses WHERE active=1 AND id IN (${warehouseIds.map(() => "?").join(",")}) FOR SHARE`,
    warehouseIds,
  );
  if (warehouses.length !== warehouseIds.length)
    throw Error("Dépôt inactif ou introuvable");
  const ids = p.lines.map((l) => l.product_id);
  const [products] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM products WHERE active=1 AND id IN (${ids.map(() => "?").join(",")}) FOR SHARE`,
    ids,
  );
  if (products.length !== ids.length)
    throw Error("Article inactif ou introuvable");
  if (p.partner_id) {
    const [partners] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM partners WHERE id=? AND active=1 FOR SHARE",
      [p.partner_id],
    );
    if (!partners.length) throw Error("Partenaire inactif ou introuvable");
  }
}
export async function documentDetail(id: string) {
  const [docs] = await db().execute<RowDataPacket[]>(
    "SELECT d.*,w.name warehouse,dw.name destination,u.name author,r.reference reversed_by FROM documents d JOIN warehouses w ON w.id=d.warehouse_id LEFT JOIN warehouses dw ON dw.id=d.destination_id JOIN users u ON u.id=d.author_id LEFT JOIN documents r ON r.reversal_of=d.id WHERE d.id=?",
    [id],
  );
  if (!docs[0]) throw Error("NOT_FOUND");
  const [lines] = await db().execute(
    "SELECT l.*,p.name,p.sku,u.name unit FROM document_lines l JOIN products p ON p.id=l.product_id JOIN units u ON u.id=p.unit_id WHERE l.document_id=? ORDER BY l.id",
    [id],
  );
  return { ...docs[0], lines };
}
