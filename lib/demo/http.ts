import { NextResponse } from "next/server";
import { z } from "zod";
import { DemoError } from "@/lib/demo/types";
export async function respond(work: () => Promise<unknown>) {
  try {
    return NextResponse.json(await work(), { headers: { "Cache-Control": "no-store" } });
  }
  catch (e) {
    const known = e instanceof DemoError;
    return NextResponse.json({ error: { code: known ? e.code : e instanceof z.ZodError ? "invalid_input" : "request_failed", message: known ? e.message : e instanceof z.ZodError ? "The request or source data does not match its schema." : "The operation could not be completed. Check the local dataset and retry." } }, { status: known ? e.status : e instanceof z.ZodError ? 400 : 500 });
  }
}
export const ActionInput = z.object({ actor: z.string().max(100).optional(), preparer: z.string().max(100).optional(), funder_id: z.enum(["fdf", "quebec"]).optional(), key: z.string().max(100).optional(), value: z.string().max(20000).optional(), expected_revision: z.number().int().positive().optional(), decision: z.enum(["approve", "decline"]).optional(), note: z.string().max(500).optional() }).strict();

export async function parseAction(req: Request) { const text = await req.text(); if (text.length > 30000) throw new DemoError("too_large", "This request is too large.", 413); let value: unknown; try { value = JSON.parse(text); } catch { throw new DemoError("invalid_json", "Use a JSON request body."); } return ActionInput.parse(value); }
