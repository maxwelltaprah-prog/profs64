import { describe, expect, it } from "vitest";

import { GET } from "@/app/preview-frame/route";

describe("GET /preview-frame", () => {
  it("serves a plain HTML shell that trusts only the request's own origin", async () => {
    const response = GET(new Request("https://app.example/preview-frame?v=3"));
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain('const PARENT = "https://app.example"');
    expect(html).toContain("event.origin !== PARENT");
    expect(html).toContain("event.source !== window.parent");
    // No framework runtime, no nonce plumbing, no markup from anywhere else.
    expect(html).not.toContain("_next");
    expect(html).not.toContain("nonce");
    expect(html).toContain('<script src="https://cdn.tailwindcss.com"></script>');
  });

  it("ignores a Host header's path tricks: the origin is derived from the URL alone", async () => {
    const html = await GET(new Request("https://evil.example/preview-frame")).text();
    expect(html).toContain('const PARENT = "https://evil.example"');
    expect(html).not.toContain("app.example");
  });
});
