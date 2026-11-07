import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/security/errors";
import { readJson } from "@/lib/security/request";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/security/schemas";

const json = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://app.example/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    ...(body !== null ? { duplex: "half" } : {}),
  } as RequestInit);

const status = async (run: Promise<unknown>) => {
  try {
    await run;
    return 200;
  } catch (error) {
    return error instanceof AppError ? error.status : -1;
  }
};

const VALID = { email: "Person@Example.com ", password: "a-long-enough-passphrase" };

describe("readJson", () => {
  it("parses a valid body and normalizes the email", async () => {
    const data = await readJson(json(JSON.stringify(VALID)), signupSchema, 1024);
    expect(data).toEqual({ email: "person@example.com", password: VALID.password });
  });

  it("rejects non-JSON content types with 415", async () => {
    for (const type of [
      "text/plain",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "",
    ]) {
      expect(
        await status(
          readJson(json(JSON.stringify(VALID), { "content-type": type }), signupSchema, 1024),
        ),
      ).toBe(415);
    }
  });

  it("rejects oversized bodies with 413, by header and by actual size", async () => {
    expect(
      await status(readJson(json("{}", { "content-length": "99999" }), signupSchema, 1024)),
    ).toBe(413);
    const big = JSON.stringify({ ...VALID, pad: "x".repeat(5000) });
    expect(await status(readJson(json(big), signupSchema, 1024))).toBe(413);
  });

  it("stops reading a streamed body that has no content-length once it passes the cap", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode("x".repeat(512)));
        if (pulled > 1000) controller.close();
      },
    });
    expect(await status(readJson(json(stream), signupSchema, 1024))).toBe(413);
    expect(pulled).toBeLessThan(10);
  });

  it.each(["{not json", "", "null", "[]", '"string"', "\u0000"])(
    "rejects malformed or non-object JSON %j",
    async (raw) => {
      expect([400, 422]).toContain(await status(readJson(json(raw), signupSchema, 1024)));
    },
  );

  it("rejects invalid UTF-8 with 400", async () => {
    const bad = new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]);
    expect(await status(readJson(json(bad), signupSchema, 1024))).toBe(400);
  });

  it("rejects unexpected keys instead of silently ignoring them", async () => {
    expect(
      await status(readJson(json(JSON.stringify({ ...VALID, role: "admin" })), signupSchema, 1024)),
    ).toBe(422);
  });
});

describe("auth schemas", () => {
  it("enforces email shape and length", () => {
    expect(signupSchema.safeParse({ ...VALID, email: "nope" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...VALID, email: `${"a".repeat(250)}@x.co` }).success).toBe(
      false,
    );
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });

  it("enforces password length on signup and reset but not on login", () => {
    expect(signupSchema.safeParse({ email: "a@b.co", password: "x".repeat(11) }).success).toBe(
      false,
    );
    expect(signupSchema.safeParse({ email: "a@b.co", password: "x".repeat(12) }).success).toBe(
      true,
    );
    expect(signupSchema.safeParse({ email: "a@b.co", password: "x".repeat(129) }).success).toBe(
      false,
    );
    expect(resetPasswordSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});
