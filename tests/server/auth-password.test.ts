import { describe, expect, it } from "vitest";
import { hashSecret, verifySecret } from "../../src/server/modules/auth/password";

describe("password hashing", () => {
  it("uses a unique salt and verifies only the correct secret", async () => {
    const first = await hashSecret("correct horse battery staple");
    const second = await hashSecret("correct horse battery staple");

    expect(first).toMatch(/^scrypt\$v1\$/);
    expect(second).not.toBe(first);
    await expect(verifySecret("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifySecret("wrong", first)).resolves.toBe(false);
  });

  it("rejects malformed encoded hashes without allocating unsafe parameters", async () => {
    await expect(verifySecret("secret", "scrypt$v1$999999999$8$1$bad$bad")).resolves.toBe(false);
    await expect(verifySecret("secret", "not-a-hash")).resolves.toBe(false);
  });
});
