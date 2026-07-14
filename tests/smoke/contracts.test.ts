import { describe, expect, it } from "vitest";
import { ReviewGradeSchema } from "../../src/shared/contracts";

describe("shared contracts", () => {
  it("accepts supported review grades", () => {
    expect(ReviewGradeSchema.parse("good")).toBe("good");
  });

  it("rejects unsupported review grades", () => {
    expect(() => ReviewGradeSchema.parse("perfect")).toThrow();
  });
});
