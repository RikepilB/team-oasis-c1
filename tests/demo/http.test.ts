import { test, expect } from "vitest";
import { POST } from "@/app/api/reports/[id]/export/route";
test("malformed export requests return a typed client error", async () => {
  const response = await POST(new Request("http://localhost/api/reports/test/export", { method: "POST", body: "{" }), { params: Promise.resolve({ id: "test" }) });
  expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("invalid_json");
});
test("export refuses client-supplied green checks", async () => {
  const response = await POST(new Request("http://localhost/api/reports/test/export", { method: "POST", body: JSON.stringify({ actor: "Reviewer", check: "green" }) }), { params: Promise.resolve({ id: "test" }) });
  expect(response.status).toBe(400);
});
