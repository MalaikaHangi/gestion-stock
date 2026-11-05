import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Plus,
  Download,
  Eye,
  Pencil,
  ArrowLeftRight,
} from "lucide-react";
import {
  csv,
  date,
  kindLabel,
  number,
  type Api,
  type Catalog,
  type Movement,
  type MovementDraft,
  type Settings,
} from "./client";
import { Confirm, Dialog, Empty, Message, Status } from "./ui";
type Result = { items: Movement[]; total: number; page: number; size: number };
export function Movements({
  api,
  catalog,
  settings,
  admin,
  online,
  version,
  open,
  changed,
}: {
  api: Api;
  catalog: Catalog;
  settings: Settings;
  admin: boolean;
  online: boolean;
  version: number;
  open: (draft?: MovementDraft, kind?: MovementDraft["kind"]) => void;
  changed: () => Promise<void>;
}) {
  const [filters, setFilters] = useState({
      kind: "",
      status: "",
      warehouse_id: "",
      from: "",
      to: "",
      q: "",
    }),
    [applied, setApplied] = useState(filters),
    [page, setPage] = useState(1),
    [result, setResult] = useState<Result>({
      items: [],
      total: 0,
      page: 1,
      size: 25,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Movement | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      run: () => Promise<void>;
    } | null>(null),
    [reversal, setReversal] = useState<Movement | null>(null),
    [reason, setReason] = useState(""),
    [reverseError, setReverseError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const query = new URLSearchParams({ ...applied, page: String(page) });
      setResult(await api<Result>("/api/documents?" + query));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, applied, page, version]);
  useEffect(() => {
    void load();
  }, [load]);
  const refresh = async () => {
    await changed();
    await load();
    if (detail) setDetail(await api<Movement>("/api/documents/" + detail.id));
  };
  const show = async (id: number) => {
    try {
      setDetail(await api<Movement>("/api/documents/" + id));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const edit = async (id: number) => {
    try {
      const d = await api<Movement>("/api/documents/" + id);
      open({ ...d, kind: d.kind as MovementDraft["kind"] });
      setDetail(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const validate = (d: Movement) =>
    setConfirm({
      title: "Valider ce mouvement ?",
      description:
        "Les quantités du stock seront mises à jour. Le document restera dans l’historique et ne pourra plus être modifié.",
      run: async () => {
        await api(
          "/api/documents/" + d.id + "/validate",
          "POST",
          undefined,
          "validate-document-" + d.id,
        );
        await refresh();
      },
    });
  const cancel = (d: Movement) =>
    setConfirm({
      title: "Annuler le brouillon ?",
      description:
        "Ce brouillon sera conservé avec le statut annulé. Le stock ne sera pas modifié.",
      run: async () => {
        await api("/api/documents/" + d.id, "DELETE");
        await refresh();
      },
    });
  const actions = (d: Movement) => (
    <div className="row-actions">
      <button
        title="Consulter"
        aria-label={"Consulter le mouvement " + d.id}
        onClick={() => void show(d.id)}
      >
        <Eye size={16} />
      </button>
      {d.status === "draft" && (
        <>
          <button
            title="Modifier"
            aria-label={"Modifier le mouvement " + d.id}
            disabled={!online}
            onClick={() => void edit(d.id)}
          >
            <Pencil size={15} />
          </button>
          <button
            className="text-action"
            disabled={!online}
            onClick={() => validate(d)}
          >
            Valider
          </button>
          <button
            className="text-danger"
            disabled={!online}
            onClick={() => cancel(d)}
          >
            Annuler
          </button>
        </>
      )}
      {admin &&
        d.status === "validated" &&
        !d.reversed_by &&
        d.kind !== "REVERSAL" && (
          <button
            className="text-action"
            disabled={!online}
            onClick={() => {
              setReversal(d);
              setReason("");
              setReverseError("");
            }}
          >
            Contrepasser
          </button>
        )}
    </div>
  );
  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>
              <ArrowLeftRight size={19} /> Entrées & sorties
            </h2>
            <p>Suivez chaque opération, du brouillon à la validation</p>
          </div>
          <div className="row-actions">
            <button
              className="outline"
              onClick={() =>
                csv("mouvements-page-" + page, [
                  [
                    "Référence",
                    "Type",
                    "Statut",
                    "Date UTC",
                    "Dépôt",
                    "Destination",
                    "Motif",
                    "Bon",
                    "Auteur",
                  ],
                  ...result.items.map((d) => [
                    d.reference || "Brouillon #" + d.id,
                    kindLabel[d.kind],
                    d.status,
                    d.created_at,
                    d.warehouse,
                    d.destination,
                    d.reason,
                    d.external_reference,
                    d.author,
                  ]),
                ])
              }
            >
              <Download size={15} /> Cette page en CSV
            </button>
            <button
              className="primary"
              onClick={() => open()}
              disabled={!online}
            >
              <Plus size={16} /> Nouveau
            </button>
          </div>
        </div>
        <form
          className="movement-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(filters);
            setPage(1);
          }}
        >
          <label className="search">
            <Search size={16} />
            <input
              aria-label="Rechercher les mouvements"
              placeholder="Article, référence, bon, motif…"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>
          <select
            aria-label="Type de mouvement"
            value={filters.kind}
            onChange={(e) => setFilters({ ...filters, kind: e.target.value })}
          >
            <option value="">Tous les types</option>
            {Object.entries(kindLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Statut"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="validated">Validé</option>
            <option value="cancelled">Annulé</option>
          </select>
          <select
            aria-label="Dépôt"
            value={filters.warehouse_id}
            onChange={(e) =>
              setFilters({ ...filters, warehouse_id: e.target.value })
            }
          >
            <option value="">Tous les dépôts</option>
            {catalog.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <label>
            Du (UTC)
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label>
            Au (UTC)
            <input
              type="date"
              min={filters.from}
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
          <button className="outline">Filtrer</button>
          <button
            type="button"
            className="outline"
            onClick={() => {
              const empty = {
                kind: "",
                status: "",
                warehouse_id: "",
                from: "",
                to: "",
                q: "",
              };
              setFilters(empty);
              setApplied(empty);
              setPage(1);
            }}
          >
            Réinitialiser
          </button>
        </form>
        <Message text={error} />
        {busy && (
          <p className="loading" role="status">
            Chargement des opérations…
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DOCUMENT / DATE</th>
                <th>TYPE</th>
                <th>DÉPÔT</th>
                <th>MOTIF / BON</th>
                <th>AUTEUR</th>
                <th>STATUT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>{d.reference || "Brouillon #" + d.id}</b>
                    <small className="block">
                      {date(d.created_at, settings.timezone)}
                    </small>
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (d.kind === "IN"
                          ? "green"
                          : d.kind === "OUT"
                            ? "red"
                            : "navy")
                      }
                    >
                      {kindLabel[d.kind]}
                    </span>
                    <small className="block">{d.line_count} article(s)</small>
                  </td>
                  <td>
                    {d.warehouse}
                    {d.destination && (
                      <small className="block">→ {d.destination}</small>
                    )}
                  </td>
                  <td>
                    {d.reason}
                    <small className="block">
                      {d.external_reference || "—"}
                    </small>
                  </td>
                  <td>{d.author}</td>
                  <td>
                    <Status value={d.status} />
                    {d.reversed_by && (
                      <small className="block">Corrigé : {d.reversed_by}</small>
                    )}
                  </td>
                  <td>{actions(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!busy && !result.items.length && (
            <Empty>
              Aucun mouvement pour ces critères. Commencez par une entrée de
              stock.
            </Empty>
          )}
        </div>
        <div className="table-footer">
          <span>
            {result.total} opération(s) · page {page} /{" "}
            {Math.max(1, Math.ceil(result.total / result.size))}
          </span>
          <div className="row-actions">
            <button
              disabled={page === 1 || busy}
              onClick={() => setPage(page - 1)}
            >
              Précédent
            </button>
            <button
              disabled={page * result.size >= result.total || busy}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          </div>
        </div>
      </section>
      {detail && (
        <Dialog
          title={detail.reference || "Brouillon #" + detail.id}
          close={() => setDetail(null)}
          wide
        >
          <div className="detail-meta">
            <span className="badge navy">{kindLabel[detail.kind]}</span>
            <Status value={detail.status} />
            <span>{date(detail.created_at, settings.timezone)}</span>
          </div>
          <div className="detail-grid">
            <p>
              <small>Dépôt</small>
              <b>
                {detail.warehouse}
                {detail.destination ? " → " + detail.destination : ""}
              </b>
            </p>
            <p>
              <small>Auteur</small>
              <b>{detail.author}</b>
            </p>
            <p>
              <small>Motif</small>
              <b>{detail.reason}</b>
            </p>
            <p>
              <small>Référence du bon</small>
              <b>{detail.external_reference || "—"}</b>
            </p>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ARTICLE</th>
                  <th>QUANTITÉ</th>
                  <th>COÛT UNITAIRE</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l) => (
                  <tr key={l.product_id}>
                    <td>
                      <b>{l.name}</b>
                      <small className="block">{l.sku}</small>
                    </td>
                    <td>
                      {number(l.quantity)} {l.unit}
                    </td>
                    <td>
                      {l.unit_cost === null
                        ? "—"
                        : number(l.unit_cost || 0) + " " + settings.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.reversed_by && (
            <p className="warning">
              Ce document a été corrigé par {detail.reversed_by}.
            </p>
          )}
          <div className="form-actions">{actions(detail)}</div>
        </Dialog>
      )}
      {confirm && (
        <Confirm
          title={confirm.title}
          description={confirm.description}
          confirm={confirm.run}
          close={() => setConfirm(null)}
        />
      )}
      {reversal && (
        <Dialog
          title="Contrepasser le mouvement"
          close={() => setReversal(null)}
        >
          <p>
            Un nouveau document inversera les quantités de {reversal.reference}.
            L’original et la correction resteront visibles. Le stock négatif est
            interdit.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  "/api/documents/" + reversal.id + "/reverse",
                  "POST",
                  { reason },
                  "reverse-document-" + reversal.id,
                );
                await refresh();
                setReversal(null);
              } catch (e) {
                setReverseError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Motif de correction
              <input
                required
                maxLength={255}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Message text={reverseError} />
            <div className="form-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setReversal(null)}
              >
                Revenir
              </button>
              <button className="primary" disabled={busy || !online}>
                Confirmer la contrepassation
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
