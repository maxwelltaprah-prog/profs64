import { describe, expect, it } from "vitest";

import { createProject, isUuid, translateDbError } from "@/lib/db/projects";
import { createProjectSchema } from "@/lib/security/schemas";
import { STARTER_FILES } from "@/lib/templates/vite-react-starter";

describe("createProjectSchema", () => {
  it("trims and accepts ordinary names", () => {
    expect(createProjectSchema.parse({ name: "  Coffee shop  " }).name).toBe("Coffee shop");
  });
  it.each([
    [{ name: "" }],
    [{ name: "   " }],
    [{ name: "a".repeat(81) }],
    [{ name: "bad\u0000name" }],
    [{ name: "ok", owner_id: "someone-else" }],
    [{}],
  ])("rejects %j", (input) => {
    expect(createProjectSchema.safeParse(input).success).toBe(false);
  });
});

describe("isUuid", () => {
  it("only accepts canonical UUIDs", () => {
    expect(isUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isUuid("../etc/passwd")).toBe(false);
    expect(isUuid("1; drop table projects")).toBe(false);
  });
});

describe("translateDbError", () => {
  it("maps cap triggers to plain messages and hides everything else", () => {
    expect(translateDbError({ message: "project limit reached" }).status).toBe(409);
    expect(translateDbError({ message: "project file limit reached" }).code).toBe("file_limit");
    expect(translateDbError({ message: "conversation limit reached" }).code).toBe(
      "conversation_limit",
    );
    const unknown = translateDbError({ message: 'relation "secret_table" does not exist' });
    expect(unknown.status).toBe(500);
    expect(unknown.message).not.toContain("secret_table");
  });
});

describe("createProject", () => {
  const fakeClient = (seedFails: boolean) => {
    const deleted: string[] = [];
    const client = {
      from: (table: string) => {
        if (table === "projects") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: "p1", name: "n", updated_at: "2026-01-01T00:00:00Z" },
                  error: null,
                }),
              }),
            }),
            delete: () => ({
              eq: async (_column: string, id: string) => {
                deleted.push(id);
                return { error: null };
              },
            }),
          };
        }
        return {
          insert: async (rows: unknown[]) => {
            expect(rows).toHaveLength(STARTER_FILES.length);
            return { error: seedFails ? { message: "project file limit reached" } : null };
          },
        };
      },
    };
    return { client, deleted };
  };

  it("seeds the starter files", async () => {
    const { client, deleted } = fakeClient(false);
    const project = await createProject("u1", "n", client as never);
    expect(project.id).toBe("p1");
    expect(deleted).toEqual([]);
  });

  it("removes the empty project when seeding fails", async () => {
    const { client, deleted } = fakeClient(true);
    await expect(createProject("u1", "n", client as never)).rejects.toMatchObject({
      code: "file_limit",
    });
    expect(deleted).toEqual(["p1"]);
  });
});
