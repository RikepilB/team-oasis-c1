import { Suspense } from "react";
import { TemplateBuilder } from "@/components/template-library";
import { Loading } from "@/components/shell";
export default function Page() { return <Suspense fallback={<main id="main" className="page"><Loading /></main>}><TemplateBuilder /></Suspense>; }
