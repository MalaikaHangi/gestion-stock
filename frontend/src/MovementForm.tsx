import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Trash2,
} from "lucide-react";
import type { Api, Catalog, MovementDraft } from "./client";
import { number } from "./client";
import { Dialog, Message } from "./ui";
export function MovementForm({
  catalog,
  api,
  initial,
  kind = "IN",
  close,
  saved,
  online,
}: {
  catalog: Catalog;
  api: Api;
  initial?: MovementDraft;
  kind?: MovementDraft["kind"];
  close: () => void;
  saved: () => Promise<void>;
  online: boolean;
}) {
  const [draft, setDraft] = useState<MovementDraft>(
    initial || {
      kind,
      warehouse_id: catalog.warehouses.find((w) => w.active)?.id || 0,
      destination_id: null,
      partner_id: null,
      external_reference: "",
      reason: "",
      lines: [
        {
          product_id: catalog.products.find((p) => p.active)?.id || 0,
          quantity: "1",
          unit_cost: null,
        },
      ],
    },
  );
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const patch = (values: Partial<MovementDraft>) =>
    setDraft({ ...draft, ...values });
  const products = catalog.products.filter(
    (p) => p.active || draft.lines.some((l) => l.product_id === p.id),
  );
  return (
    <Dialog
      title={initial ? "Modifier le brouillon" : "Nouveau mouvement"}
      close={close}
      wide
    >
      <p>
        Le brouillon n’affecte pas le stock. Vous pourrez le vérifier puis le
        valider.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              initial ? "/api/documents/" + initial.id : "/api/documents",
              initial ? "PUT" : "POST",
              draft,
              key,
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
        <div className="type-switch">
          {(
            [
              { value: "IN", label: "Entrée", Icon: ArrowDownLeft },
              { value: "OUT", label: "Sortie", Icon: ArrowUpRight },
              { value: "TRANSFER", label: "Transfert", Icon: ArrowLeftRight },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              className={draft.kind === value ? "selected" : ""}
              onClick={() => patch({ kind: value, partner_id: null })}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Dépôt {draft.kind === "TRANSFER" ? "source" : ""}
            <select
              required
              value={draft.warehouse_id}
              onChange={(e) => patch({ warehouse_id: Number(e.target.value) })}
            >
              <option value="">Choisir un dépôt</option>
              {catalog.warehouses
                .filter((w) => w.active)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </label>
          {draft.kind === "TRANSFER" ? (
            <label>
              Dépôt destination
              <select
                required
                value={draft.destination_id || ""}
                onChange={(e) =>
                  patch({ destination_id: Number(e.target.value) })
                }
              >
                <option value="">Choisir un dépôt</option>
                {catalog.warehouses
                  .filter((w) => w.active && w.id !== draft.warehouse_id)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label>
              {draft.kind === "IN"
                ? "Fournisseur / partenaire"
                : "Client / destinataire"}
              <select
                value={draft.partner_id || ""}
                onChange={(e) =>
                  patch({ partner_id: Number(e.target.value) || null })
                }
              >
                <option value="">Non renseigné</option>
                {catalog.partners
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        <div className="form-grid">
          <label>
            Référence du bon
            <input
              maxLength={100}
              placeholder="BL, facture ou bon de sortie"
              value={draft.external_reference}
              onChange={(e) => patch({ external_reference: e.target.value })}
            />
          </label>
          <label>
            Motif
            <input
              required
              maxLength={255}
              placeholder={
                draft.kind === "IN"
                  ? "Réception fournisseur, retour…"
                  : "Consommation, vente, perte…"
              }
              value={draft.reason}
              onChange={(e) => patch({ reason: e.target.value })}
            />
          </label>
        </div>
        <div className="line-heading">
          <h3>Articles du mouvement</h3>
          <button
            type="button"
            className="outline"
            onClick={() =>
              patch({
                lines: [
                  ...draft.lines,
                  { product_id: 0, quantity: "1", unit_cost: null },
                ],
              })
            }
          >
            <Plus size={15} /> Ajouter une ligne
          </button>
        </div>
        {draft.lines.map((line, index) => {
          const balance = catalog.balances.find(
            (b) =>
              b.product_id === line.product_id &&
              b.warehouse_id === draft.warehouse_id,
          );
          const product = catalog.products.find(
            (p) => p.id === line.product_id,
          );
          return (
            <div className="movement-line" key={index}>
              <label>
                Article
                <select
                  required
                  value={line.product_id || ""}
                  onChange={(e) =>
                    patch({
                      lines: draft.lines.map((l, i) =>
                        i === index
                          ? { ...l, product_id: Number(e.target.value) }
                          : l,
                      ),
                    })
                  }
                >
                  <option value="">Choisir un article</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
                <small>
                  Disponible dans ce dépôt : {number(balance?.quantity || 0)}{" "}
                  {product?.unit}
                </small>
              </label>
              <label>
                Quantité
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.quantity}
                  onChange={(e) =>
                    patch({
                      lines: draft.lines.map((l, i) =>
                        i === index ? { ...l, quantity: e.target.value } : l,
                      ),
                    })
                  }
                />
              </label>
              {draft.kind === "IN" && (
                <label>
                  Coût unitaire
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={line.unit_cost ?? ""}
                    onChange={(e) =>
                      patch({
                        lines: draft.lines.map((l, i) =>
                          i === index
                            ? { ...l, unit_cost: e.target.value || null }
                            : l,
                        ),
                      })
                    }
                  />
                </label>
              )}
              <button
                type="button"
                aria-label={"Retirer la ligne " + (index + 1)}
                disabled={draft.lines.length === 1}
                onClick={() =>
                  patch({ lines: draft.lines.filter((_, i) => i !== index) })
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          );
        })}
        <Message text={error} />
        <div className="form-actions">
          <button className="outline" type="button" onClick={close}>
            Annuler
          </button>
          <button
            className="primary"
            disabled={!online || busy || !catalog.products.length}
          >
            {busy ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
        </div>
        {!online && (
          <p className="form-error">Une connexion au serveur est nécessaire.</p>
        )}
      </form>
    </Dialog>
  );
}
