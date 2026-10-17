import { describe, expect, it } from "vitest";
import { PEOPLE, actionFor, canDo, whoCan } from "@/lib/demo/people";

describe("demo people", () => {
  it("has distinct names, so the self-approval check can tell people apart", () => {
    const names = PEOPLE.map(p => p.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every action exactly one role", () => {
    expect(canDo("preparer", "prepare")).toBe(true);
    expect(canDo("preparer", "approve")).toBe(false);
    expect(canDo("reviewer", "review")).toBe(true);
    expect(canDo("reviewer", "approve")).toBe(false);
    expect(canDo("approver", "approve")).toBe(true);
    expect(canDo("approver", "export")).toBe(true);
    expect(canDo("approver", "prepare")).toBe(false);
    expect(canDo("admin", "settings")).toBe(true);
    expect(canDo("admin", "approve")).toBe(false);
  });

  it("switches to a person who can act, never the preparer for approval", () => {
    expect(whoCan("review").role).toBe("reviewer");
    expect(whoCan("approve").role).toBe("approver");
    expect(whoCan("approve").name).not.toBe(whoCan("prepare").name);
  });

  it("maps report steps to actions", () => {
    expect(["extract", "clean", "validate", "french", "template", "edit"].map(actionFor)).toEqual(Array(6).fill("prepare"));
    expect(actionFor("review")).toBe("review");
    expect(actionFor("french_item")).toBe("review");
    expect(actionFor("approve")).toBe("approve");
    expect(actionFor("export")).toBe("export");
  });
});
