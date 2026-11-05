import { db, type RowDataPacket } from "./db";
export async function companyDefaults() {
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT stock_warehouse_id,stock_unit_id FROM app_settings WHERE id=1",
  );
  if (!rows[0]?.stock_warehouse_id)
    throw Error("Configuration du stock manquante");
  return {
    warehouse: rows[0].stock_warehouse_id as number,
    unit: rows[0].stock_unit_id as number,
  };
}
export async function companyMovement(body: Record<string, unknown>) {
  const { warehouse } = await companyDefaults();
  return {
    ...body,
    warehouse_id: warehouse,
    destination_id: null,
    partner_id: null,
    external_reference: "",
    reason: body.kind === "OUT" ? "Sortie de stock" : "Entrée de stock",
  };
}
