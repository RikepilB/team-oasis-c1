import { respond, ActionInput } from "@/lib/demo/http";
import { runAction } from "@/lib/demo/workflow";
import { DemoError } from "@/lib/demo/types";
export async function POST(req: Request, { params }: {
  params: Promise<{
    id: string;
    action: string;
  }>;
}) {
  return respond(async () => {
    const { id, action } = await params; const text = await req.text(); if (text.length > 30000)
      throw new DemoError("too_large", "This request is too large.", 413); let body; try {
        body = JSON.parse(text);
      }
    catch {
      throw new DemoError("invalid_json", "Use a JSON request body.");
    } return runAction(id, action, ActionInput.parse(body));
  });
}
