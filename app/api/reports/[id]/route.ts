import { respond } from "@/lib/demo/http";
import { getRecord } from "@/lib/demo/workflow";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: {
  params: Promise<{
    id: string;
  }>;
}) { const { id } = await params; return respond(() => getRecord(id)); }
