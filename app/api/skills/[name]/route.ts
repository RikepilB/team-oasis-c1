import { NextResponse } from "next/server";
import { SHIPPED_FILES_CACHE } from "@/lib/demo/http";
import { skillMarkdown } from "@/lib/demo/standard";
export const dynamic = "force-dynamic";
// Downloads the exact SKILL.md of a registered skill, so its version hash matches what the register shows.
export async function GET(_req: Request, { params }: {
  params: Promise<{
    name: string;
  }>;
}) {
  const { name } = await params;
  const text = skillMarkdown(name);
  if (text === null) return NextResponse.json({ error: { code: "not_found", message: "No skill in the standard has this name." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(text, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9_-]/gi, "_")}.SKILL.md"`, "Cache-Control": SHIPPED_FILES_CACHE } });
}
