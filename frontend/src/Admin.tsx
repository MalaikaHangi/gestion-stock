import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import {
  date,
  type Api,
  type Catalog,
  type Product,
  type Reference,
  type Settings,
  type User,
} from "./client";
import { Confirm, Dialog, Empty, Message, Skeleton } from "./ui";
type Values = Record<string, string | number | boolean | null | undefined>;
const referenceNames: Record<string, string> = {
  categories: "Catégories",
};
export function Admin({
  page,
  api,
  catalog,
  settings,
  changed,
  currentId,
  signedOut,
}: {
  page: string;
  api: Api;
  catalog: Catalog;
  settings: Settings;
  changed: () => Promise<void>;
  currentId: number;
  signedOut: () => void;
}) {
  const [resource, setResource] = useState("categories"),
    [loading, setLoading] = useState(true),
    [rows, setRows] = useState<Values[]>([]),
    [editing, setEditing] = useState<Values | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<Values | null>(null),
    [auditPage, setAuditPage] = useState(1);
  const base =
    page === "Utilisateurs"
      ? "/api/users"
      : page === "Référentiels"
        ? "/api/references/" + resource
        : page === "Journal d’audit"
          ? "/api/audit?page=" + auditPage
          : "/api/settings";
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      if (page === "Paramètres") return;
      setRows(await api<Values[]>(base));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, base, page]);
  useEffect(() => {
    setEditing(null);
    void load();
  }, [load]);
  if (page === "Paramètres")
    return <SettingsForm api={api} settings={settings} changed={changed} />;
  const isUser = page === "Utilisateurs",
    isAudit = page === "Journal d’audit";
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    const values: Values = {
      ...editing,
      name: String(f.get("name") || ""),
      active: f.get("active") === "on",
    };
    if (isUser) {
      values.email = String(f.get("email"));
      values.role = String(f.get("role"));
      const password = String(f.get("password") || "");
      if (password) values.password = password;
      else delete values.password;
    }
    if (resource === "categories" && !isUser)
      values.parent_id = Number(f.get("parent_id")) || null;
    if (resource === "partners" && !isUser) {
      values.kind = String(f.get("kind"));
      values.email = String(f.get("email") || "");
    }
    if (resource === "locations" && !isUser)
      values.warehouse_id = Number(f.get("warehouse_id"));
    try {
      await api(base, editing.id ? "PUT" : "POST", values);
      setEditing(null);
      if (isUser && editing.id === currentId) {
        signedOut();
        return;
      }
      await load();
      await changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>{page === "Référentiels" ? "Catégories" : page}</h2>
            <p>
              {isUser
                ? "Deux rôles : administrateur et responsable. Les comptes désactivés restent dans l’historique."
                : isAudit
                  ? "Traçabilité des opérations et de leurs auteurs."
                  : "Les références utilisées sont désactivées pour préserver l’historique."}
            </p>
          </div>
          {!isAudit && (
            <button
              className="primary"
              onClick={() => {
                setError("");
                setEditing({ active: true, role: "manager", kind: "supplier" });
              }}
            >
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
        {page === "Référentiels" && (
          <div className="admin-tabs">
            {Object.entries(referenceNames).map(([key, label]) => (
              <button
                key={key}
                className={resource === key ? "selected" : ""}
                onClick={() => setResource(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <Message text={!editing ? error : ""} />
        {loading && <Skeleton />}
        <div className="table-scroll" hidden={loading}>
          <table>
            <thead>
              <tr>
                {isAudit ? (
                  <>
                    <th>DATE</th>
                    <th>AUTEUR</th>
                    <th>ACTION</th>
                    <th>DOCUMENT</th>
                  </>
                ) : (
                  <>
                    <th>NOM</th>
                    {(isUser || resource === "partners") && <th>E-MAIL</th>}
                    {isUser && <th>RÔLE</th>}
                    <th>ÉTAT / DÉTAIL</th>
                    <th>ACTIONS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) =>
                isAudit ? (
                  <tr key={String(row.id || index)}>
                    <td>{date(String(row.created_at), settings.timezone)}</td>
                    <td>{row.author}</td>
                    <td>{row.action}</td>
                    <td>{row.reference || row.document_id || "—"}</td>
                  </tr>
                ) : (
                  <tr key={String(row.id)}>
                    <td>
                      <b>{String(row.name)}</b>
                    </td>
                    {(isUser || resource === "partners") && (
                      <td>{row.email || "—"}</td>
                    )}
                    {isUser && (
                      <td>
                        {row.role === "admin"
                          ? "Administrateur"
                          : row.role === "manager"
                            ? "Responsable"
                            : "Ancien compte lecteur"}
                      </td>
                    )}
                    <td>
                      {row.active === undefined ? (
                        "—"
                      ) : row.active ? (
                        <span className="badge green">Actif</span>
                      ) : (
                        <span className="badge red">Désactivé</span>
                      )}
                      {row.kind && (
                        <small className="block">
                          {row.kind === "supplier" ? "Fournisseur" : "Client"}
                        </small>
                      )}
                      {row.parent_id && (
                        <small className="block">
                          Parent :{" "}
                          {
                            catalog.categories.find(
                              (c) => c.id === row.parent_id,
                            )?.name
                          }
                        </small>
                      )}
                      {row.warehouse_id && (
                        <small className="block">
                          {
                            catalog.warehouses.find(
                              (w) => w.id === row.warehouse_id,
                            )?.name
                          }
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label={"Modifier " + row.name}
                          onClick={() => {
                            setError("");
                            setEditing({
                              ...row,
                              role:
                                row.role === "reader" ? "manager" : row.role,
                            });
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        {!isUser && (
                          <button
                            aria-label={"Supprimer " + row.name}
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {!rows.length && <Empty>Aucun élément enregistré.</Empty>}
        </div>
        {isAudit && (
          <div className="table-footer">
            <button
              disabled={auditPage === 1}
              onClick={() => setAuditPage(auditPage - 1)}
            >
              Précédent
            </button>
            <span>Page {auditPage}</span>
            <button
              disabled={rows.length < 50}
              onClick={() => setAuditPage(auditPage + 1)}
            >
              Suivant
            </button>
          </div>
        )}
      </section>
      {editing && (
        <Dialog
          title={
            (editing.id ? "Modifier" : "Ajouter") +
            " — " +
            (isUser ? "Utilisateur" : referenceNames[resource])
          }
          close={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <label>
              Nom
              <input
                required
                name="name"
                maxLength={100}
                defaultValue={String(editing.name || "")}
              />
            </label>
            {(isUser || resource === "partners") && (
              <label>
                E-mail
                <input
                  required={isUser}
                  type="email"
                  name="email"
                  defaultValue={String(editing.email || "")}
                />
              </label>
            )}
            {isUser && (
              <>
                <label>
                  Rôle
                  <select
                    name="role"
                    defaultValue={String(editing.role || "manager")}
                  >
                    <option value="manager">Responsable</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </label>
                <label>
                  {editing.id
                    ? "Nouveau mot de passe (facultatif)"
                    : "Mot de passe"}
                  <input
                    type="password"
                    name="password"
                    minLength={8}
                    maxLength={256}
                    required={!editing.id}
                    autoComplete="new-password"
                  />
                  <small>
                    8 caractères minimum. Toute modification révoque les
                    sessions du compte.
                  </small>
                </label>
              </>
            )}
            {!isUser && resource === "categories" && (
              <label>
                Catégorie parente
                <select
                  name="parent_id"
                  defaultValue={Number(editing.parent_id) || ""}
                >
                  <option value="">Aucune</option>
                  {catalog.categories
                    .filter((c) => c.id !== editing.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {!isUser && resource === "partners" && (
              <label>
                Type
                <select
                  name="kind"
                  defaultValue={String(editing.kind || "supplier")}
                >
                  <option value="supplier">Fournisseur</option>
                  <option value="customer">Client</option>
                </select>
              </label>
            )}
            {!isUser && resource === "locations" && (
              <label>
                Dépôt
                <select
                  required
                  name="warehouse_id"
                  defaultValue={Number(editing.warehouse_id) || ""}
                >
                  <option value="">Choisir</option>
                  {catalog.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(isUser || !["units", "locations"].includes(resource)) && (
              <label className="check-label">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={!!editing.active}
                />{" "}
                Compte ou référence actif
              </label>
            )}
            <Message text={error} />
            <div className="form-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setEditing(null)}
              >
                Annuler
              </button>
              <button className="primary" disabled={busy}>
                <Save size={16} />
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Confirm
          title="Supprimer cette référence ?"
          description={
            "La suppression de « " +
            deleting.name +
            " » est possible seulement si aucun document ne l’utilise. Sinon, désactivez-la."
          }
          close={() => setDeleting(null)}
          confirm={async () => {
            await api(base + "?id=" + deleting.id, "DELETE");
            await load();
            await changed();
          }}
        />
      )}
    </>
  );
}
function SettingsForm({
  api,
  settings,
  changed,
}: {
  api: Api;
  settings: Settings;
  changed: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <div>
          <h2>Paramètres de l’organisation</h2>
          <p>Configuration commune aux deux rôles</p>
        </div>
      </div>
      <form
        key={JSON.stringify(settings)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setSuccess(false);
          const f = new FormData(e.currentTarget);
          try {
            await api("/api/settings", "PUT", Object.fromEntries(f));
            await changed();
            setError("");
            setSuccess(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Organisation
          <input
            required
            name="organisation"
            maxLength={100}
            defaultValue={settings.organisation}
          />
        </label>
        <label>
          Devise
          <select name="currency" defaultValue={settings.currency}>
            {["EUR", "USD", "CDF", "ZAR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Fuseau d’affichage
          <select name="timezone" defaultValue={settings.timezone}>
            {[
              "Africa/Johannesburg",
              "Africa/Kinshasa",
              "Africa/Lubumbashi",
              "UTC",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <small>Les filtres des rapports sont exprimés en journées UTC.</small>
        </label>
        <Message text={error} />
        {success && <p className="success">Paramètres enregistrés.</p>}
        <button className="primary" disabled={busy}>
          <Save size={16} /> Enregistrer
        </button>
      </form>
    </section>
  );
}
export function ProductForm({
  api,
  catalog,
  product,
  close,
  saved,
}: {
  api: Api;
  catalog: Catalog;
  product?: Product;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={product ? "Modifier l’article" : "Nouvel article"}
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const values = {
            name: String(f.get("name")),
            category_id: Number(f.get("category_id")),
            minimum: String(f.get("minimum")),
            cost: String(f.get("cost")),
            barcode: String(f.get("barcode") || "") || null,
            active: f.get("active") === "on",
          };
          try {
            await api(
              product ? "/api/catalog/" + product.id : "/api/catalog",
              product ? "PUT" : "POST",
              values,
            );
            await saved();
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted">
          Référence SKU :{" "}
          {product?.sku || "attribuée automatiquement à l’enregistrement"}
        </p>
        <label>
          Nom
          <input
            required
            name="name"
            maxLength={150}
            defaultValue={product?.name}
          />
        </label>
        <div className="form-grid">
          <label>
            Catégorie
            <select
              required
              name="category_id"
              defaultValue={product?.category_id || ""}
            >
              <option value="">Choisir</option>
              {catalog.categories
                .filter((c) => c.active || c.id === product?.category_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Seuil minimum
            <input
              required
              name="minimum"
              type="number"
              min="0"
              step="0.001"
              defaultValue={product?.minimum || "0"}
            />
          </label>
          <label>
            Coût indicatif
            <input
              required
              name="cost"
              type="number"
              min="0"
              step="0.0001"
              defaultValue={product?.cost || "0"}
            />
          </label>
        </div>
        <label>
          Code-barres
          <input
            name="barcode"
            maxLength={80}
            defaultValue={product?.barcode || ""}
          />
        </label>
        <label className="check-label">
          <input
            name="active"
            type="checkbox"
            defaultChecked={product ? !!product.active : true}
          />{" "}
          Article actif
        </label>
        <Message text={error} />
        <div className="form-actions">
          <button className="outline" type="button" onClick={close}>
            Annuler
          </button>
          <button className="primary" disabled={busy}>
            Enregistrer
          </button>
        </div>
      </form>
    </Dialog>
  );
}
