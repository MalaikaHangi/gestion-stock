import { z } from "zod";
import { db } from "../../../lib/db";
import { authorize, administrator } from "../../../lib/security";
import { response, failure, preflight } from "../../../lib/http";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  try {
    await authorize(request);
    const [rows] = await db().query("SELECT * FROM app_settings WHERE id=1");
    return response(request, Array.isArray(rows) ? rows[0] : {});
  } catch (e) {
    return failure(request, e);
  }
}
export async function PUT(request: Request) {
  try {
    await administrator(request);
    const parsed = z
      .object({
        organisation: z.string().trim().min(1).max(100),
        currency: z.enum(["EUR", "USD", "CDF", "ZAR"]),
        timezone: z.enum([
          "Africa/Johannesburg",
          "Africa/Kinshasa",
          "Africa/Lubumbashi",
          "UTC",
        ]),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      return response(request, { error: "Paramètres invalides." }, 400);
    const v = parsed.data;
    await db().execute(
      "UPDATE app_settings SET organisation=?,currency=?,timezone=? WHERE id=1",
      [v.organisation, v.currency, v.timezone],
    );
    return response(request, { ok: true });
  } catch (e) {
    return failure(request, e);
  }
}
