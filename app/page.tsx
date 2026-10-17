import { Suspense } from "react";
import { Inbox } from "@/components/inbox";
import { Loading } from "@/components/shell";
export default function Home() {
  return <Suspense fallback={<main id="main" className="inbox-page"><Loading /></main>}><Inbox /></Suspense>;
}
