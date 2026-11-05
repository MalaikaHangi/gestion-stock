export async function GET() {
  // Startup verifies PostgreSQL and migrations. Avoid waking the free database on every health probe.
  return Response.json({ status: "ok" });
}
