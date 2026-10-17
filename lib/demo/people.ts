// Demo people. Picking one stands in for signing in; it is not a permission system.
// The server enforces only two rules: the approver differs from the preparer, and French is reviewed.
export type Role = "preparer" | "reviewer" | "approver" | "admin";
export type Action = "prepare" | "review" | "approve" | "export" | "settings";
export type Person = { id: string; name: string; role: Role; title_en: string; title_fr: string };

// Names must stay distinct: the self-approval check compares names.
export const PEOPLE: Person[] = [
  { id: "daniel", name: "Daniel", role: "preparer", title_en: "Grants & Compliance Officer", title_fr: "Agent, subventions et conformité" },
  { id: "grace", name: "Grace", role: "preparer", title_en: "Programme Manager, Kijana", title_fr: "Gestionnaire de programme, Kijana" },
  { id: "content", name: "Bilingual Content Coordinator", role: "reviewer", title_en: "Reviews French before approval", title_fr: "Révise le français avant l’approbation" },
  { id: "director", name: "Director, International Programmes", role: "approver", title_en: "Approves funder reports", title_fr: "Approuve les rapports aux bailleurs" },
  { id: "finance", name: "Director, Finance & Operations", role: "admin", title_en: "Administrator and privacy officer", title_fr: "Administrateur et responsable de la vie privée" },
];

export const ROLE_LABEL: Record<Role, [string, string]> = {
  preparer: ["Preparer", "Préparateur"],
  reviewer: ["Bilingual reviewer", "Réviseur bilingue"],
  approver: ["Approver", "Approbateur"],
  admin: ["Administrator", "Administrateur"],
};

const ALLOWED: Record<Action, Role[]> = { prepare: ["preparer"], review: ["reviewer"], approve: ["approver"], export: ["approver"], settings: ["admin"] };

export function canDo(role: Role, action: Action) {
  return ALLOWED[action].includes(role);
}

// The first person whose role may take the action: the target of "Switch to …".
export function whoCan(action: Action): Person {
  return PEOPLE.find(p => canDo(p.role, action))!;
}

// Maps a report API step to the role-level action that gates it.
export function actionFor(step: string): Action {
  if (step === "review" || step === "french_item") return "review";
  if (step === "approve") return "approve";
  if (step === "export") return "export";
  return "prepare";
}
