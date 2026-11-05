export type User = {
  id: number;
  name: string;
  email?: string;
  role: "admin" | "manager";
  active?: number | boolean;
};
export type Session = { token: string; user: User };
export type Reference = {
  id: number;
  name: string;
  active?: number | boolean;
  parent_id?: number | null;
  warehouse_id?: number;
  kind?: string;
  email?: string;
};
export type Product = Reference & {
  sku: string;
  category_id: number;
  unit_id: number;
  barcode?: string | null;
  category: string;
  unit: string;
  quantity: string;
  minimum: string;
  cost: string;
};
export type Catalog = {
  products: Product[];
  warehouses: Reference[];
  categories: Reference[];
  units: Reference[];
  partners: Reference[];
  balances: {
    warehouse_id: number;
    product_id: number;
    quantity: string;
    minimum: string | null;
  }[];
  syncedAt: string;
};
export type Settings = {
  organisation: string;
  currency: string;
  timezone: string;
};
export type MovementLine = {
  product_id: number;
  quantity: string;
  unit_cost?: string | null;
  name?: string;
  sku?: string;
  unit?: string;
};
export type Movement = {
  id: number;
  reference: string | null;
  kind: "IN" | "OUT" | "TRANSFER" | "REVERSAL";
  status: "draft" | "validated" | "cancelled";
  warehouse_id: number;
  destination_id: number | null;
  partner_id: number | null;
  external_reference: string;
  reason: string;
  warehouse: string;
  destination?: string;
  author: string;
  created_at: string;
  validated_at: string | null;
  line_count: number;
  reversed_by?: string;
  reversal_of?: number;
  lines: MovementLine[];
};
export type MovementDraft = {
  id?: number;
  kind: "IN" | "OUT";
  warehouse_id: number;
  destination_id: number | null;
  partner_id: number | null;
  reason: string;
  external_reference: string;
  lines: MovementLine[];
};
export type Api = <T = unknown>(
  path: string,
  method?: string,
  body?: unknown,
  key?: string,
) => Promise<T>;
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const API_URL = (
  env.VITE_API_URL || (env.DEV ? "http://localhost:3000" : "")
).replace(/\/+$/, "");
export function client(session: Session | null): Api {
  return async function <T>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ) {
    if (!API_URL) throw Error("L’adresse du serveur n’est pas configurée.");
    const response = await fetch(API_URL + path, {
      method,
      cache: "no-store",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(session ? { Authorization: "Bearer " + session.token } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response
      .json()
      .catch(() => ({ error: "Réponse du serveur invalide." }));
    if (!response.ok) throw Error(data.error || "Erreur du serveur");
    return data as T;
  };
}
export const number = (value: number | string) =>
  Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
export const kindLabel: Record<string, string> = {
  IN: "Entrée",
  OUT: "Sortie",
  TRANSFER: "Ancienne opération",
  REVERSAL: "Contrepassation",
};
export function date(value: string | null, timezone: string) {
  return value
    ? new Date(value.endsWith("Z") ? value : value + "Z").toLocaleString(
        "fr-FR",
        { timeZone: timezone, dateStyle: "short", timeStyle: "short" },
      )
    : "—";
}
export function csv(name: string, rows: unknown[][]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".csv";
  link.click();
  URL.revokeObjectURL(url);
}
