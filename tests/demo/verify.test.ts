import { describe, test, expect } from "vitest";
import { tokens, checkFact, checkFrench, checkNarrative } from "@/lib/demo/verify";
describe("numerical integrity", () => {
  test("keeps quantities that resemble years", () => { expect(tokens("2,026 people")).toEqual([{ value: 2026, unit: "count" }]); });
  test("only masks contextual periods and ISO dates", () => { expect(tokens("Q1 FY2026–27, 2026-06-30, 2,026 people")).toEqual([{ value: 2026, unit: "count" }]); });
  test("French decimal and thousands formats agree", () => { expect(checkFrench("85.3% and 1,900 people", "85,3 % et 1 900 personnes").check).toBe("green"); });
  test("lost repeated numbers are rejected", () => { expect(checkFrench("12 groups and 12 repairs", "12 groupes").check).toBe("red"); });
  test("percent and counts are distinct", () => { expect(checkFrench("85%", "85 personnes").check).toBe("red"); });
  test("invented extra numbers are rejected", () => { expect(checkFrench("85%", "85 % et 3").check).toBe("red"); });
  test("facts require a verbatim quote", () => { expect(checkFact({ value: 85, unit: "%", quote: "Functionality is 85%" }, "Functionality was 85%.").check).toBe("red"); });
  test("fact values must match their own quote", () => { expect(checkFact({ value: 86, unit: "%", quote: "Functionality is 85%." }, "Functionality is 85%.").check).toBe("red"); });
  test("empty quotes are rejected", () => { expect(checkFact({ value: "working", unit: null, quote: "" }, "working").check).toBe("red"); });
  test("unresolved and red citations block narrative", () => {
    expect(checkNarrative("85%", ["unknown"], [{ id: "F-01", value: 85, unit: "%", valid: true }]).check).toBe("red");
    expect(checkNarrative("85%", ["F-01"], [{ id: "F-01", value: 85, unit: "%", valid: false }]).check).toBe("red");
  });
  test("wrong or uncited figures are rejected", () => {
    expect(checkNarrative("86%", ["F-01"], [{ id: "F-01", value: 85, unit: "%", valid: true }]).check).toBe("red");
  });
  test("valid cited percent passes", () => { expect(checkNarrative("85%", ["F-01"], [{ id: "F-01", value: 85, unit: "%", valid: true }]).check).toBe("green"); });
  test("missing narrative cannot pass", () => { expect(checkNarrative("", [], []).check).toBe("red"); });
  test("no number is required for a qualitative statement", () => { expect(checkNarrative("The baseline definition is unspecified.", [], []).check).toBe("green"); });
});

import { guardPersonalData } from "@/lib/harness/guard";
test.each(["(416) 555-0199", "+1 (416) 555 0199", "4165550199", "416-555-0199"])("guards phone format %s", (phone) => { expect(guardPersonalData(phone).ok).toBe(false); });
test("dates and ordinary report quantities are not phones", () => { expect(guardPersonalData("2026-06-30, 1,900 people, 85.3%").ok).toBe(true); });
