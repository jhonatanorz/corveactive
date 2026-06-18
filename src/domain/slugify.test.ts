import { describe, it, expect } from "vitest";
import { slugify } from "@/domain/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Faldas Cortas")).toBe("faldas-cortas");
  });
  it("strips accents", () => {
    expect(slugify("Niños y Café")).toBe("ninos-y-cafe");
  });
  it("trims surrounding whitespace and hyphens", () => {
    expect(slugify("  Tank-Top  ")).toBe("tank-top");
    expect(slugify("//Shorts//")).toBe("shorts");
  });
  it("collapses runs of non-alphanumerics into a single hyphen", () => {
    expect(slugify("a   b__c")).toBe("a-b-c");
  });
  it("returns empty string for empty / symbol-only input", () => {
    expect(slugify("   ")).toBe("");
    expect(slugify("///")).toBe("");
  });
});
