export function response(request: Request, data: unknown, status = 200) {
  const origin = request.headers.get("origin");
  const allowed = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim());
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(origin && allowed.includes(origin)
        ? { "Access-Control-Allow-Origin": origin }
        : {}),
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Idempotency-Key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
  });
}
export function failure(request: Request, error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur interne";
  const code = (error as { code?: string })?.code;
  const status =
    message === "UNAUTHORIZED"
      ? 401
      : message === "FORBIDDEN"
        ? 403
        : message === "NOT_FOUND"
          ? 404
          : [
                "ER_DUP_ENTRY",
                "ER_ROW_IS_REFERENCED_2",
                "ER_NO_REFERENCED_ROW_2",
                "ER_LOCK_DEADLOCK",
                "ER_LOCK_WAIT_TIMEOUT",
                "ER_SIGNAL_EXCEPTION",
                "23505",
                "23503",
                "23514",
                "40P01",
                "40001",
                "55P03",
                "P0001",
              ].includes(code || "")
            ? 409
            : 500;
  const labels: Record<string, string> = {
    UNAUTHORIZED: "Votre session a expiré. Connectez-vous.",
    FORBIDDEN: "Action non autorisée pour ce rôle.",
    NOT_FOUND: "Élément introuvable.",
  };
  const text =
    code === "ER_DUP_ENTRY" || code === "23505"
      ? "Cette référence existe déjà."
      : code === "ER_ROW_IS_REFERENCED_2" || code === "23503"
        ? "Élément déjà utilisé : désactivez-le au lieu de le supprimer."
        : code === "ER_NO_REFERENCED_ROW_2"
          ? "Une référence sélectionnée n’existe plus."
          : code === "ER_LOCK_DEADLOCK" || code === "ER_LOCK_WAIT_TIMEOUT"
            ? "Une autre opération est en cours. Réessayez."
            : labels[message] || message;
  if (status === 500) console.error("[API]", code || "INTERNAL_ERROR");
  return response(
    request,
    {
      error:
        status === 500
          ? "Service indisponible. Réessayez dans quelques instants."
          : text,
    },
    status,
  );
}
export function preflight(request: Request) {
  return response(request, {}, 200);
}
