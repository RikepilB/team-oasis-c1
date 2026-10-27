import { Suspense } from "react";
import { SkillWizard } from "@/components/skills";
import { Loading } from "@/components/shell";
export default function Page() { return <Suspense fallback={<main id="main" className="page"><Loading /></main>}><SkillWizard /></Suspense>; }
