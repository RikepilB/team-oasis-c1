// Report detail tabs, shared by the server page (deep links) and the client workspace.
export const TABS = [["overview", "Overview", "Aperçu"], ["original", "Original", "Original"], ["draft", "Standardized draft", "Ébauche normalisée"], ["issues", "Issues & evidence", "Problèmes et données"], ["french", "French version", "Version française"], ["approvals", "Approvals & access", "Approbations et accès"], ["activity", "Activity", "Activité"]] as const;
export type Tab = typeof TABS[number][0];
// Old ?step= links keep working: each workflow step now lives inside one tab.
export const STEP_TAB: Record<string, Tab> = { record: "original", extract: "issues", clean: "issues", validate: "issues", french: "french", review: "french", template: "draft", approve: "approvals", export: "approvals" };
export function tabFor(tab?: string, step?: string): Tab { return TABS.some(t => t[0] === tab) ? tab as Tab : step && STEP_TAB[step] || "overview"; }
