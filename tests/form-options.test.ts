import { describe, expect, it } from "vitest";
import { needsCurrentValueOption } from "@/lib/ui/form-options";

describe("needsCurrentValueOption", () => {
  it("flags a current value that is missing from the options list (e.g. an archived account)", () => {
    // Regression: a <select>'s defaultValue pointing at an id not present in
    // any <option> makes the browser silently select the first option, which
    // previously caused ContactEditForm/ActivityForm to silently reassign a
    // record to the wrong account/contact/opportunity on an unrelated save.
    expect(needsCurrentValueOption("archived-account-1", [{ id: "active-account-1" }, { id: "active-account-2" }])).toBe(true);
  });

  it("does not flag a current value that is present in the options list", () => {
    expect(needsCurrentValueOption("active-account-1", [{ id: "active-account-1" }, { id: "active-account-2" }])).toBe(false);
  });

  it("does not flag an unset (null/undefined/empty) current value", () => {
    expect(needsCurrentValueOption(null, [{ id: "active-account-1" }])).toBe(false);
    expect(needsCurrentValueOption(undefined, [{ id: "active-account-1" }])).toBe(false);
    expect(needsCurrentValueOption("", [{ id: "active-account-1" }])).toBe(false);
  });

  it("flags a current value when the options list is empty", () => {
    expect(needsCurrentValueOption("archived-account-1", [])).toBe(true);
  });
});
