import { describe, expect, it, vi } from "vitest";

import { getSharedProject } from "@/lib/db/share";

vi.mock("server-only", () => ({}));

const client = (result: { data: unknown; error: unknown }) =>
  ({ rpc: async () => result }) as never;

describe("getSharedProject", () => {
  it("returns name and only well-formed files", async () => {
    const shared = await getSharedProject(
      "slug",
      client({
        data: [
          {
            name: "My app",
            files: [{ path: "src/App.tsx", content: "x" }, { path: 1, content: "y" }, "bad"],
          },
        ],
        error: null,
      }),
    );
    expect(shared).toEqual({ name: "My app", files: [{ path: "src/App.tsx", content: "x" }] });
  });

  it("returns null when nothing matches or the read errors", async () => {
    expect(await getSharedProject("slug", client({ data: [], error: null }))).toBeNull();
    expect(await getSharedProject("slug", client({ data: null, error: { code: "x" } }))).toBeNull();
  });
});
