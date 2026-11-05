import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Boxes,
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  Plus,
  Download,
  LogOut,
  Wifi,
  WifiOff,
  Package,
  TriangleAlert,
  ChevronRight,
  Warehouse,
  ShieldCheck,
  Users,
  Settings as SettingsIcon,
  BookOpen,
  ListChecks,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  API_URL,
  client,
  csv,
  number,
  type Catalog,
  type MovementDraft,
  type Product,
  type Session,
  type Settings,
} from "./client";
import { MovementForm } from "./MovementForm";
import { Movements } from "./Movements";
import { Reports } from "./Reports";
import { Admin, ProductForm } from "./Admin";
import { Confirm, Empty, Message } from "./ui";
import "./style.css";
import "./operations.css";
const emptyCatalog: Catalog = {
  products: [],
  warehouses: [],
  categories: [],
  units: [],
  partners: [],
  balances: [],
  syncedAt: "",
};
const defaultSettings: Settings = {
  organisation: "StockMaster",
  currency: "EUR",
  timezone: "Africa/Johannesburg",
};
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [catalog, setCatalog] = useState<Catalog>(emptyCatalog),
    [settings, setSettings] = useState(defaultSettings),
    [page, setPage] = useState("Entrées & sorties"),
    [online, setOnline] = useState(navigator.onLine),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [version, setVersion] = useState(0),
    [movement, setMovement] = useState<{
      initial?: MovementDraft;
      kind: MovementDraft["kind"];
    } | null>(null),
    [product, setProduct] = useState<Product | null | undefined>(undefined),
    [deleting, setDeleting] = useState<Product | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [warehouse, setWarehouse] = useState("");
  const api = useMemo(() => client(session), [session]);
  const admin = session?.user.role === "admin";
  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api<Catalog>(
          "/api/catalog" + (session.user.role === "admin" ? "?all=1" : ""),
        ),
        api<Settings>("/api/settings"),
      ]);
      setCatalog(c);
      setSettings(s);
      setError("");
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, session]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (session && online) void refresh();
  }, [refresh, session, online]);
  const signedOut = () => {
    setSession(null);
    setCatalog(emptyCatalog);
    setSettings(defaultSettings);
    setMovement(null);
    setProduct(undefined);
    setNotice("");
    setError("");
  };
  const logout = async () => {
    try {
      await api("/api/auth", "DELETE");
    } finally {
      signedOut();
    }
  };
  const open = (initial?: MovementDraft, kind: MovementDraft["kind"] = "IN") =>
    setMovement({ initial, kind });
  if (!session)
    return (
      <Login
        connected={(s) => {
          setSession(s);
          setPage("Entrées & sorties");
        }}
        online={online}
      />
    );
  const baseNav = [
    { label: "Entrées & sorties", Icon: ArrowLeftRight },
    { label: "Tableau de bord", Icon: LayoutDashboard },
    { label: "Inventaire & articles", Icon: Boxes },
    { label: "État du stock", Icon: Download },
  ];
  const adminNav = [
    { label: "Référentiels", Icon: Warehouse },
    { label: "Utilisateurs", Icon: Users },
    { label: "Journal d’audit", Icon: ListChecks },
    { label: "Paramètres", Icon: SettingsIcon },
  ];
  const products = catalog.products.map((p) => ({
    ...p,
    quantity: warehouse
      ? catalog.balances.find(
          (b) => b.product_id === p.id && String(b.warehouse_id) === warehouse,
        )?.quantity || "0"
      : p.quantity,
  }));
  const filtered = products.filter(
    (p) =>
      (p.name + " " + p.sku).toLowerCase().includes(query.toLowerCase()) &&
      (!category || p.category === category),
  );
  const alerts = products.filter(
    (p) => p.active && Number(p.quantity) <= Number(p.minimum),
  );
  const exportStock = () =>
    csv("stock", [
      ["SKU", "Article", "Catégorie", "Quantité", "Unité", "Statut"],
      ...filtered.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.quantity,
        p.unit,
        p.active ? "Actif" : "Désactivé",
      ]),
    ]);
  return (
    <>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Entrées & sorties");
          }}
        >
          <span className="brandmark">
            <Boxes size={25} />
          </span>
          StockMaster<span className="version">10</span>
        </a>
        <div className="header-right">
          <span className={"connection " + (!online ? "offline" : "")}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
            {online ? "Connecté au serveur" : "Hors connexion"}
          </span>
          <button className="primary" disabled={!online} onClick={() => open()}>
            <Plus size={17} /> Nouveau mouvement
          </button>
          <div className="profile-name">
            <b>{session.user.name}</b>
            <small>{admin ? "Administrateur" : "Responsable"}</small>
          </div>
          <button
            className="avatar"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            onClick={() => void logout()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <aside>
        <div className="workspace">
          <span className="workspace-icon">
            <Warehouse size={22} />
          </span>
          <div>
            <b>{settings.organisation}</b>
            <small>
              {admin ? "Administration du stock" : "Espace responsable"}
            </small>
          </div>
        </div>
        <p className="eyebrow">OPÉRATIONS DE STOCK</p>
        <nav>
          {[...baseNav, ...(admin ? adminNav : [])].map(({ label, Icon }) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => setPage(label)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={23} />
          <b>Une gestion centralisée.</b>
          <p>Chaque entrée et sortie est conservée dans votre historique.</p>
          <span>Données enregistrées sur le serveur</span>
        </div>
      </aside>
      <main>
        <div className="breadcrumb">
          {settings.organisation} <ChevronRight size={13} />
          <b>{page}</b>
        </div>
        {!online && (
          <div className="warning">
            Connexion interrompue. Les quantités affichées peuvent être
            anciennes. Les opérations exigent une connexion au serveur.
          </div>
        )}
        <Message text={error} />
        {notice && (
          <button className="success notice" onClick={() => setNotice("")}>
            {notice} · Fermer
          </button>
        )}
        {loading && (
          <p role="status" className="loading">
            Actualisation du stock…
          </p>
        )}
        {page === "Entrées & sorties" ? (
          <>
            <div className="page-intro">
              <div>
                <span className="eyebrow">LE CŒUR DE VOTRE ACTIVITÉ</span>
                <h1>
                  Vos entrées. Vos sorties.
                  <br />
                  <em>Votre stock, en toute clarté.</em>
                </h1>
                <p>
                  Enregistrez, vérifiez et retrouvez chaque mouvement de
                  marchandise.
                </p>
              </div>
              <div className="quick-actions">
                <button
                  className="quick-in"
                  disabled={!online}
                  onClick={() => open(undefined, "IN")}
                >
                  <ArrowDownLeft /> Enregistrer une entrée
                </button>
                <button
                  className="quick-out"
                  disabled={!online}
                  onClick={() => open(undefined, "OUT")}
                >
                  <ArrowUpRight /> Enregistrer une sortie
                </button>
              </div>
            </div>
            <Movements
              api={api}
              catalog={catalog}
              settings={settings}
              admin={admin}
              online={online}
              version={version}
              open={open}
              changed={refresh}
            />
          </>
        ) : page === "État du stock" ? (
          <Reports
            api={api}
            catalog={catalog}
            settings={settings}
            version={version}
          />
        ) : admin && adminNav.some((n) => n.label === page) ? (
          <Admin
            page={page}
            api={api}
            catalog={catalog}
            settings={settings}
            changed={refresh}
            currentId={session.user.id}
            signedOut={signedOut}
          />
        ) : (
          <>
            {page === "Tableau de bord" && (
              <>
                <section className="hero">
                  <div>
                    <span className="hero-tag">
                      <span /> GESTION CENTRALISÉE DES STOCKS
                    </span>
                    <h1>
                      Chaque article compte.
                      <br />
                      <em>Gardez une longueur d’avance.</em>
                    </h1>
                    <p>
                      Vos disponibilités, calculées à partir des mouvements
                      validés.
                    </p>
                    <div className="hero-meta">
                      <Warehouse size={15} /> Tous les dépôts <span>•</span>
                      {catalog.syncedAt
                        ? "Actualisé à " +
                          new Date(catalog.syncedAt).toLocaleTimeString(
                            "fr-FR",
                            { timeZone: settings.timezone },
                          )
                        : "En cours de chargement"}
                    </div>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="orbit" />
                    <Boxes size={108} strokeWidth={1} />
                    <span className="art-label">
                      <ShieldCheck size={15} /> Chaque mouvement est traçable
                    </span>
                  </div>
                </section>
                <div className="stats">
                  {[
                    {
                      label: "Articles actifs",
                      value: number(
                        catalog.products.filter((p) => p.active).length,
                      ),
                      Icon: Package,
                      color: "blue",
                    },
                    {
                      label: "Dépôts actifs",
                      value: number(
                        catalog.warehouses.filter((w) => w.active).length,
                      ),
                      Icon: Warehouse,
                      color: "navy",
                    },
                    {
                      label: "Alertes de stock",
                      value: number(alerts.length),
                      Icon: TriangleAlert,
                      color: "amber",
                    },
                    {
                      label: "Valeur indicative",
                      value:
                        number(
                          catalog.products.reduce(
                            (sum, p) =>
                              sum + Number(p.quantity) * Number(p.cost),
                            0,
                          ),
                        ) +
                        " " +
                        settings.currency,
                      Icon: Boxes,
                      color: "green",
                    },
                  ].map(({ label, value, Icon, color }) => (
                    <article className="stat" key={label}>
                      <div>
                        <span>{label}</span>
                        <span className={"stat-icon " + color}>
                          <Icon size={20} />
                        </span>
                      </div>
                      <strong>{value}</strong>
                      <small>Données du serveur</small>
                    </article>
                  ))}
                </div>
              </>
            )}
            <div className="content-grid">
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>
                      Inventaire des articles{" "}
                      <span className="count">{catalog.products.length}</span>
                    </h2>
                    <p>
                      {admin
                        ? "Gérez vos articles et consultez leur disponibilité."
                        : "Consultez la disponibilité avant chaque opération."}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button className="outline" onClick={exportStock}>
                      <Download size={16} /> CSV
                    </button>
                    {admin && (
                      <button
                        className="primary"
                        onClick={() => setProduct(null)}
                      >
                        <Plus size={16} /> Article
                      </button>
                    )}
                  </div>
                </div>
                <div className="filters">
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Rechercher un article"
                      placeholder="Article, SKU…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Catégorie"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Toutes les catégories</option>
                    {[...new Set(catalog.products.map((p) => p.category))].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label="Dépôt"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                  >
                    <option value="">Tous les dépôts</option>
                    {catalog.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>ARTICLE / RÉFÉRENCE</th>
                        <th>CATÉGORIE</th>
                        <th>DISPONIBLE</th>
                        <th>STATUT</th>
                        {admin && <th>ACTIONS</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="product-cell">
                              <span className="product-icon">
                                <Package size={21} />
                              </span>
                              <div>
                                <b>{p.name}</b>
                                <small>{p.sku}</small>
                              </div>
                            </div>
                          </td>
                          <td>{p.category}</td>
                          <td>
                            <b>{number(p.quantity)}</b> <small>{p.unit}</small>
                          </td>
                          <td>
                            <span
                              className={
                                "badge " +
                                (!p.active
                                  ? "navy"
                                  : Number(p.quantity) === 0
                                    ? "red"
                                    : Number(p.quantity) <= Number(p.minimum)
                                      ? "amber"
                                      : "green")
                              }
                            >
                              {!p.active
                                ? "Désactivé"
                                : Number(p.quantity) === 0
                                  ? "Rupture"
                                  : Number(p.quantity) <= Number(p.minimum)
                                    ? "Stock faible"
                                    : "En stock"}
                            </span>
                          </td>
                          {admin && (
                            <td>
                              <div className="row-actions">
                                <button
                                  aria-label={"Modifier " + p.name}
                                  onClick={() => setProduct(p)}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  aria-label={"Supprimer " + p.name}
                                  onClick={() => setDeleting(p)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length && (
                    <Empty>
                      {catalog.products.length
                        ? "Aucun article pour ces critères."
                        : admin
                          ? "Ajoutez les catégories, unités et dépôts dans Référentiels, puis créez vos articles."
                          : "L’administrateur doit d’abord créer les articles du catalogue."}
                    </Empty>
                  )}
                </div>
                <div className="table-footer">
                  {filtered.length} article(s)
                  <span>Les brouillons ne modifient pas le stock</span>
                </div>
              </section>
              <div className="right-column">
                <section className="panel alerts">
                  <div className="panel-title">
                    <h2>
                      <TriangleAlert size={18} /> Points de vigilance
                    </h2>
                    <span className="count">{alerts.length}</span>
                  </div>
                  {alerts.slice(0, 10).map((p) => (
                    <div className="alert-item" key={p.id}>
                      <span
                        className={
                          Number(p.quantity) === 0
                            ? "alert-dot red"
                            : "alert-dot amber"
                        }
                      />
                      <div>
                        <b>{p.name}</b>
                        <small>
                          Disponible : {number(p.quantity)} · Minimum :{" "}
                          {number(p.minimum)}
                        </small>
                      </div>
                    </div>
                  ))}
                  {!alerts.length && <Empty>Aucune alerte de stock.</Empty>}
                </section>
                <section className="tip">
                  <span className="eyebrow">CHAQUE OPÉRATION COMPTE</span>
                  <h3>
                    Un historique
                    <br />
                    toujours accessible.
                  </h3>
                  <p>
                    Retrouvez le bon, les articles et l’auteur de chaque entrée
                    ou sortie.
                  </p>
                  <button
                    className="outline"
                    onClick={() => setPage("Entrées & sorties")}
                  >
                    <BookOpen size={14} /> Ouvrir le journal
                  </button>
                </section>
              </div>
            </div>
          </>
        )}
        <footer>
          <span>{settings.organisation} · StockMaster</span>
          <span>Affichage : {settings.timezone}</span>
        </footer>
      </main>
      {movement && (
        <MovementForm
          catalog={catalog}
          api={api}
          initial={movement.initial}
          kind={movement.kind}
          online={online}
          close={() => setMovement(null)}
          saved={async () => {
            await refresh();
            setPage("Entrées & sorties");
            setNotice(
              "Brouillon enregistré. Vérifiez-le puis validez-le pour mettre à jour le stock.",
            );
          }}
        />
      )}
      {product !== undefined && (
        <ProductForm
          api={api}
          catalog={catalog}
          product={product || undefined}
          close={() => setProduct(undefined)}
          saved={refresh}
        />
      )}
      {deleting && (
        <Confirm
          title="Supprimer cet article ?"
          description={
            "L’article « " +
            deleting.name +
            " » sera supprimé s’il n’a aucune dépendance. Pour un article déjà utilisé, désactivez-le depuis Modifier."
          }
          close={() => setDeleting(null)}
          confirm={async () => {
            await api("/api/catalog/" + deleting.id, "DELETE");
            await refresh();
          }}
        />
      )}
    </>
  );
}
function Login({
  connected,
  online,
}: {
  connected: (session: Session) => void;
  online: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const api = useMemo(() => client(null), []);
  return (
    <div className="login-screen">
      <section className="login-intro">
        <a className="brand" href="#">
          <span className="brandmark">
            <Boxes size={28} />
          </span>
          StockMaster <span className="version">10</span>
        </a>
        <span className="hero-tag">GESTION DES ENTRÉES ET SORTIES</span>
        <h1>
          Le bon mouvement.
          <br />
          <em>Au bon moment.</em>
        </h1>
        <p>
          Un stock centralisé, deux rôles et une traçabilité complète de vos
          opérations.
        </p>
        <div className="login-features">
          <span>
            <ArrowDownLeft size={20} /> Réceptions & approvisionnements
          </span>
          <span>
            <ArrowUpRight size={20} /> Sorties & consommations
          </span>
          <span>
            <ShieldCheck size={20} /> Historique et contrôle des stocks
          </span>
        </div>
      </section>
      <section className="login-card">
        <span className="modal-symbol">
          <ShieldCheck />
        </span>
        <h2>Connexion à votre espace</h2>
        <p>Administrateur ou responsable, retrouvez votre stock en ligne.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(event.currentTarget);
            try {
              connected(
                await api<Session>("/api/auth", "POST", {
                  email: f.get("email"),
                  password: f.get("password"),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            E-mail
            <input required type="email" name="email" autoComplete="username" />
          </label>
          <label>
            Mot de passe
            <input
              required
              type="password"
              name="password"
              autoComplete="current-password"
            />
          </label>
          <Message text={error} />
          {!online && (
            <p className="form-error">Une connexion Internet est nécessaire.</p>
          )}
          {!API_URL && (
            <p className="form-error">
              Le serveur de l’application doit être configuré par
              l’administrateur.
            </p>
          )}
          <button
            className="primary full"
            disabled={busy || !online || !API_URL}
          >
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="login-footer">
          Vos données sont enregistrées sur le serveur de votre organisation.
        </p>
      </section>
    </div>
  );
}
// Remove browser-only records from the early prototype; operational data now lives on the server.
try {
  for (const key of Object.keys(localStorage))
    if (key.startsWith("stock-cache-") || key.startsWith("stock-draft-"))
      localStorage.removeItem(key);
} catch {
  // The application also works when browser storage is disabled.
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (
  (import.meta as unknown as { env: { PROD: boolean } }).env.PROD &&
  "serviceWorker" in navigator
)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
