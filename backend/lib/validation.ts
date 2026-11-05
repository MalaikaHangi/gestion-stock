import { z } from "zod";
export const quantity = z
  .string()
  .regex(/^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,3})?$/);
export const decimal = z.string().regex(/^\d{1,12}(\.\d{1,3})?$/);
export const price = z.string().regex(/^\d{1,12}(\.\d{1,4})?$/);
export const productSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(150),
  category_id: z.number().int().positive(),
  unit_id: z.number().int().positive(),
  minimum: decimal,
  cost: price,
  barcode: z.string().max(80).nullable().optional(),
  active: z.boolean().default(true),
});
export const movementSchema = z
  .object({
    kind: z.enum(["IN", "OUT", "TRANSFER"]),
    warehouse_id: z.number().int().positive(),
    destination_id: z.number().int().positive().nullable().optional(),
    partner_id: z.number().int().positive().nullable().optional(),
    external_reference: z.string().trim().max(100).default(""),
    reason: z.string().trim().min(1).max(255),
    lines: z
      .array(
        z.object({
          product_id: z.number().int().positive(),
          quantity,
          unit_cost: price.nullable().optional(),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (p) => new Set(p.lines.map((l) => l.product_id)).size === p.lines.length,
    "Produits en double",
  )
  .refine(
    (p) =>
      p.kind !== "TRANSFER" ||
      (p.destination_id && p.destination_id !== p.warehouse_id),
    "Destination invalide",
  );
