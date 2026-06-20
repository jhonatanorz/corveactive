import { describe, it, expect } from "vitest";
import { tallyByCategory, isForeignKeyViolation } from "@/domain/category-usage";

describe("tallyByCategory", () => {
  it("counts rows per category id", () => {
    const rows = [{ category_id: "a" }, { category_id: "b" }, { category_id: "a" }];
    expect(tallyByCategory(rows)).toEqual({ a: 2, b: 1 });
  });

  it("returns an empty map for no rows", () => {
    expect(tallyByCategory([])).toEqual({});
  });
});

describe("isForeignKeyViolation", () => {
  it("is true for a Postgres 23503 error object", () => {
    expect(isForeignKeyViolation({ code: "23503", message: "violates foreign key" })).toBe(true);
  });

  it("is false for other error codes", () => {
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
  });

  it("is false for non-object / code-less values", () => {
    expect(isForeignKeyViolation(new Error("boom"))).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation("23503")).toBe(false);
  });
});
