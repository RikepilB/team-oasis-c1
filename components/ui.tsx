"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/shell";

// Design system v3.2 helpers: every unavailable action explains itself, every nested page has a way back,
// and the export confirmation is a real dialog instead of a bare button.

type GuardedProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  /** Why the action can't run right now, phrased as what to do next. Null or empty means it can run. */
  reason?: string | null;
  /** Shown while a step is running; the button stays unavailable with a "Working…" tooltip. */
  busy?: boolean;
};

/**
 * A button that never fails silently. When unavailable it stays focusable (aria-disabled), shows a
 * tooltip with the reason on hover and keyboard focus, and repeats it on click.
 */
export function GuardedButton({ reason, busy, onClick, children, className, type = "button", ...rest }: GuardedProps) {
  const { t } = useLanguage();
  const id = useId();
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const why = busy ? t("Another step is running. Wait for it to finish.", "Une autre étape est en cours. Attendez la fin.") : reason || "";
  const blocked = !!why;
  return <span className={"tip-wrap" + (flash ? " tip-flash" : "")}>
    <button
      {...rest}
      type={type}
      className={className}
      aria-disabled={blocked || undefined}
      aria-describedby={blocked ? id : rest["aria-describedby"]}
      onClick={e => {
        if (blocked) {
          e.preventDefault();
          setFlash(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setFlash(false), 2600);
          return;
        }
        onClick?.(e);
      }}
    >{children}</button>
    {blocked && <span role="tooltip" id={id} className="tip">{why}</span>}
  </span>;
}

/** A hover and focus tooltip for any element that isn't a button: read-only fields, icons, truncated names. */
export function Tip({ text, children, block }: { text: string; children: React.ReactNode; block?: boolean }) {
  const id = useId();
  return <span className={"tip-wrap" + (block ? " tip-block" : "")} tabIndex={0} aria-describedby={id}>{children}<span role="tooltip" id={id} className="tip">{text}</span></span>;
}

// Pages that sit one level below a main section, and where "Back" goes if there's no browser history.
const PARENTS: [RegExp, string, string, string][] = [
  [/^\/runs\//, "/", "Inbox", "Boîte de réception"],
  [/^\/evidence\//, "/sources", "Files & sources", "Fichiers et sources"],
  [/^\/templates\/.+/, "/templates", "Templates", "Gabarits"],
  [/^\/standard/, "/sources", "Files & sources", "Fichiers et sources"],
  [/^\/log/, "/sources", "Files & sources", "Fichiers et sources"],
];

/** Shown above the content on every nested page, so a person is never stuck one layer down. */
export function BackBar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const parent = PARENTS.find(([re]) => re.test(pathname));
  if (!parent) return null;
  const [, href, en, fr] = parent;
  const goBack = (e: React.MouseEvent) => {
    // Use the browser history when the visitor came from inside Synapse; otherwise go to the parent section.
    const internal = typeof document !== "undefined" && document.referrer.startsWith(location.origin) && history.length > 1;
    if (internal) { e.preventDefault(); router.back(); }
  };
  return <div className="back-bar"><Link href={href} onClick={goBack} className="back-link"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>{t("Back", "Retour")}<span className="back-target">{t("to " + en, "à " + fr)}</span></Link></div>;
}

export type ExportFormat = "pdf" | "docx";

/**
 * Confirm-export dialog. In "confirm" mode it logs the export first and then downloads; in "download" mode
 * (already exported) it only downloads the same approved revision again.
 */
export function ExportDialog({ open, mode, onClose, onConfirm, summary, busy }: {
  open: boolean;
  mode: "confirm" | "download";
  onClose: () => void;
  onConfirm: (format: ExportFormat) => void;
  summary: { label: string; value: string }[];
  busy?: boolean;
}) {
  const { t } = useLanguage();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const options: [ExportFormat, string, string, string, string][] = [
    ["pdf", "PDF", "PDF", "Fixed layout for sharing and printing. Best for sending to the funder.", "Mise en page fixe, pour partager et imprimer. Idéal pour le bailleur."],
    ["docx", "Word document", "Document Word", "Editable .docx for final formatting in Word or Google Docs.", "Fichier .docx modifiable, pour la mise en forme finale."],
  ];
  return <dialog ref={dialog} className="export-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <form method="dialog" className="export-dialog-body" onSubmit={e => { e.preventDefault(); onConfirm(format); }}>
      <header className="export-dialog-head">
        <p className="dialog-eyebrow">{mode === "confirm" ? t("Step 2 of 2 · Export", "Étape 2 sur 2 · Export") : t("Download again", "Télécharger de nouveau")}</p>
        <h2 id={titleId}>{mode === "confirm" ? t("Confirm export", "Confirmer l’export") : t("Download the exported report", "Télécharger le rapport exporté")}</h2>
        <p>{mode === "confirm"
          ? t("This locks the approved revision and records your name in the activity log. Nothing is emailed; you send the file yourself.", "Cela verrouille la révision approuvée et inscrit votre nom au journal. Aucun courriel n’est envoyé; vous envoyez le fichier vous-même.")
          : t("This is the same approved revision that was exported. Downloading again is not logged as a new export.", "C’est la même révision approuvée. Un nouveau téléchargement n’est pas un nouvel export.")}</p>
      </header>
      <dl className="export-summary">{summary.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>
      <fieldset className="format-options">
        <legend>{t("Choose a format", "Choisissez un format")}</legend>
        {options.map(([value, en, fr, hintEn, hintFr]) => <label key={value} className="format-option" data-checked={format === value || undefined}>
          <input type="radio" name="export-format" value={value} checked={format === value} onChange={() => setFormat(value)} />
          <span className="format-icon" aria-hidden="true">{value === "pdf" ? "PDF" : "DOC"}</span>
          <span><strong>{t(en, fr)}</strong><small>{t(hintEn, hintFr)}</small></span>
        </label>)}
      </fieldset>
      <footer className="export-dialog-actions">
        <button type="button" className="secondary" onClick={onClose}>{t("Cancel", "Annuler")}</button>
        <GuardedButton type="submit" className="primary" busy={busy}>{mode === "confirm"
          ? t("Export and download", "Exporter et télécharger")
          : t("Download", "Télécharger")} {format === "pdf" ? "PDF" : "Word"}</GuardedButton>
      </footer>
    </form>
  </dialog>;
}

/** Starts a file download from a same-origin URL without leaving the page. */
export function downloadFile(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
