import RunWorkspace from "@/components/run-workspace";
import { tabFor } from "@/lib/demo/report-tabs";
export default async function Run({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;step?:string;funder?:string}>}){const {id}=await params;const q=await searchParams;return <RunWorkspace id={id} tab={tabFor(q.tab,q.step)} initialFunder={q.funder}/>;}
