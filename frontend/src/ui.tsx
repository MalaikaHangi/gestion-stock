import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, LoaderCircle } from "lucide-react";
export function Spinner() {
  return <LoaderCircle className="spinner" size={18} aria-hidden="true" />;
}
export function Skeleton() {
  return (
    <div
      className="skeleton-layout"
      role="status"
      aria-label="Chargement des données"
      aria-live="polite"
    >
      <span className="sr-only">Chargement des données…</span>
      <div className="skeleton skeleton-heading" />
      <div className="skeleton-cards">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton skeleton-card" key={i} />
        ))}
      </div>
      <div className="skeleton-table">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="skeleton skeleton-row" key={i} />
        ))}
      </div>
    </div>
  );
}
export function Dialog({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const container = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    container.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const elements = container.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <section
        ref={container}
        tabIndex={-1}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button className="close" aria-label="Fermer" onClick={close}>
          <X size={20} />
        </button>
        <span className="eyebrow">STOCKMASTER</span>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
export function Confirm({
  title,
  description,
  confirm,
  close,
}: {
  title: string;
  description: string;
  confirm: () => Promise<void>;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      title={title}
      close={() => {
        if (!busy) close();
      }}
    >
      <p>{description}</p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="outline" disabled={busy} onClick={close}>
          Revenir
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await confirm();
              close();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <Spinner /> Traitement…
            </>
          ) : (
            "Confirmer"
          )}
        </button>
      </div>
    </Dialog>
  );
}
export function Message({ text }: { text: string }) {
  return text ? (
    <p className="form-error" role="alert">
      {text}
    </p>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (value === "validated"
          ? "green"
          : value === "cancelled"
            ? "red"
            : "amber")
      }
    >
      {value === "validated"
        ? "Validé"
        : value === "cancelled"
          ? "Annulé"
          : "Brouillon"}
    </span>
  );
}
