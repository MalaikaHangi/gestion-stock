import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
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
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    container.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
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
      previous?.focus();
    };
  }, [close]);
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
    <Dialog title={title} close={close}>
      <p>{description}</p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="outline" onClick={close}>
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
          {busy ? "Traitement…" : "Confirmer"}
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
