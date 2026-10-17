import { Suspense } from "react";
import { Inbox } from "@/components/inbox";
import { Loading } from "@/components/shell";
export default function Page() { return <Suspense fallback={<main id="main" className="page inbox-page"><Loading /></main>}><Inbox mode="reports" /></Suspense>; }
