"use client";
import { useState } from "react";
import { useLanguage, useRemote, Loading, Message } from "@/components/shell";
import type { AuditEvent } from "@/lib/demo/types";
export default function Log() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("");
  const { data, error, loading } = useRemote<{
    entries: AuditEvent[];
    valid: boolean;
  }>("/api/log");
  const rows = (data?.entries || []).filter(e => !filter || e.action === filter).toReversed();
  return <main id="main" className="page"><div className="page-heading"><p className="eyebrow">{t("EVERY CHECK. EVERY DECISION.", "CHAQUE CONTRÔLE. CHAQUE DÉCISION.")}</p><h1>{t("The activity trail", "Le journal d’activité")}</h1><p>{t("Recorded attempts, checks, corrections, and human decisions are appended to a local hash-chained log.", "Les tentatives, contrôles, corrections et décisions humaines sont ajoutés à un journal local chaîné par hachage.")}</p></div><Message error={error} />{loading ? <Loading /> : data && <><div className={"message " + (data.valid ? "success" : "error")}>{data.valid ? "✓" : "✕"} {data.valid ? t("Chain verified", "Chaîne vérifiée") : t("Chain integrity failed", "Intégrité de la chaîne rompue")} · {data.entries.length} {t("entries", "entrées")}</div><p className="muted small">{t("This detects changes within the stored chain. It is a local demonstration, not an externally anchored audit service.", "Ce mécanisme détecte les modifications dans la chaîne conservée. Il s’agit d’une démonstration locale.")}</p><div className="filters"><label>{t("Action", "Action")}<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">{t("All actions", "Toutes les actions")}</option>{[...new Set(data.entries.map(e => e.action))].map(a => <option key={a} value={a}>{a}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>{t("Time", "Heure")}</th><th>{t("Person", "Personne")}</th><th>Action</th><th>{t("Report", "Rapport")}</th><th>{t("Detail", "Détail")}</th></tr></thead><tbody>{rows.map(e => <tr key={e.id}><td>{new Date(e.at).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td><td>{e.actor}</td><td>{e.action}</td><td><code>{e.record_id}</code></td><td><details><summary>{String(e.detail.job || e.detail.field || e.detail.funder_id || t("View entry", "Voir l’entrée"))}</summary><pre className="audit-detail">{JSON.stringify(e.detail, null, 2)}</pre><code>{e.hash.slice(0, 16)}</code></details></td></tr>)}</tbody></table>{!rows.length && <p className="panel">{t("No entries yet. Start a report to create its trail.", "Aucune entrée. Commencez un rapport pour créer sa trace.")}</p>}</div></>}</main>;
}
