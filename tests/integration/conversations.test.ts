import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asService,
  asUser,
  CHECK_VIOLATION,
  createUser,
  PERMISSION_DENIED,
  pool,
  prepareDatabase,
  sqlState,
} from "./helpers";

let alice: string;
let bob: string;
let aliceChat: string;

const insertChat = (owner: string, title = "Chat") =>
  asService(
    async (db) => {
      const { rows } = await db.query(
        "insert into conversations (owner_id, title) values ($1, $2) returning id",
        [owner, title],
      );
      return rows[0].id as string;
    },
    { commit: true },
  );

beforeAll(async () => {
  await prepareDatabase();
  alice = await createUser("alice-chat");
  bob = await createUser("bob-chat");
  aliceChat = await insertChat(alice, "Alice plans");
  await asService(
    async (db) => {
      await db.query(
        `insert into conversation_messages (conversation_id, role, parts) values
           ($1, 'user', '[{"type":"text","text":"hi"}]'), ($1, 'assistant', '[{"type":"text","text":"hello"}]')`,
        [aliceChat],
      );
      await db.query(
        `insert into conversation_documents (conversation_id, kind, title, spec)
         values ($1, 'docx', 'Plan', '{"blocks":[]}')`,
        [aliceChat],
      );
    },
    { commit: true },
  );
});

afterAll(async () => {
  await pool.end();
});

describe("conversations are private to their owner", () => {
  it("owners see their conversations, messages and documents; others see nothing", async () => {
    const own = await asUser(alice, async (db) => ({
      chats: (await db.query("select id from conversations")).rowCount,
      messages: (await db.query("select id from conversation_messages")).rowCount,
      documents: (await db.query("select id from conversation_documents")).rowCount,
    }));
    expect(own).toEqual({ chats: 1, messages: 2, documents: 1 });

    const other = await asUser(bob, async (db) => ({
      chats: (await db.query("select id from conversations where id = $1", [aliceChat])).rowCount,
      messages: (
        await db.query("select id from conversation_messages where conversation_id = $1", [
          aliceChat,
        ])
      ).rowCount,
      documents: (
        await db.query("select id from conversation_documents where conversation_id = $1", [
          aliceChat,
        ])
      ).rowCount,
    }));
    expect(other).toEqual({ chats: 0, messages: 0, documents: 0 });

    const anon = await asAnon(async (db) => sqlState(db.query("select id from conversations")));
    expect(anon).toBe(PERMISSION_DENIED);
  });

  it("a user cannot create a conversation for someone else or write into theirs", async () => {
    expect(
      await asUser(bob, (db) =>
        sqlState(db.query("insert into conversations (owner_id, title) values ($1, 'x')", [alice])),
      ),
    ).toBe(PERMISSION_DENIED);
    expect(
      await asUser(bob, (db) =>
        sqlState(
          db.query(
            `insert into conversation_messages (conversation_id, role, parts) values ($1, 'user', '[]')`,
            [aliceChat],
          ),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
    const renamed = await asUser(bob, (db) =>
      db.query("update conversations set title = 'pwned' where id = $1", [aliceChat]),
    );
    expect(renamed.rowCount).toBe(0);
    const deleted = await asUser(bob, (db) =>
      db.query("delete from conversations where id = $1", [aliceChat]),
    );
    expect(deleted.rowCount).toBe(0);
  });

  it("owners cannot forge assistant replies or documents, or move a chat to another owner", async () => {
    expect(
      await asUser(alice, (db) =>
        sqlState(
          db.query(
            `insert into conversation_messages (conversation_id, role, parts) values ($1, 'assistant', '[]')`,
            [aliceChat],
          ),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
    expect(
      await asUser(alice, (db) =>
        sqlState(
          db.query(
            `insert into conversation_documents (conversation_id, kind, title, spec) values ($1, 'pdf', 'x', '{}')`,
            [aliceChat],
          ),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
    expect(
      await asUser(alice, (db) =>
        sqlState(
          db.query("update conversations set owner_id = $1 where id = $2", [bob, aliceChat]),
        ),
      ),
    ).toBe(PERMISSION_DENIED);
    const own = await asUser(alice, async (db) => {
      await db.query(
        `insert into conversation_messages (conversation_id, role, parts) values ($1, 'user', '[{"type":"text","text":"more"}]')`,
        [aliceChat],
      );
      return (
        await db.query("update conversations set title = 'Renamed' where id = $1", [aliceChat])
      ).rowCount;
    });
    expect(own).toBe(1);
  });

  it("rejects bad kinds, oversized documents and empty titles", async () => {
    const bad = (sql: string, params: unknown[]) =>
      asService((db) => sqlState(db.query(sql, params)));
    expect(
      await bad(
        "insert into conversation_documents (conversation_id, kind, title, spec) values ($1, 'exe', 'x', '{}')",
        [aliceChat],
      ),
    ).toBe(CHECK_VIOLATION);
    expect(
      await bad(
        "insert into conversation_documents (conversation_id, kind, title, spec) values ($1, 'pdf', 'x', $2)",
        [aliceChat, JSON.stringify({ text: "x".repeat(300_000) })],
      ),
    ).toBe(CHECK_VIOLATION);
    expect(await bad("insert into conversations (owner_id, title) values ($1, '')", [alice])).toBe(
      CHECK_VIOLATION,
    );
  });

  it("deleting the account removes conversations, and the export includes them", async () => {
    const carol = await createUser("carol-chat");
    const chat = await insertChat(carol, "Carol");
    const exported = await asService(async (db) => {
      const { rows } = await db.query("select export_user_data($1) as data", [carol]);
      return rows[0].data as Record<string, unknown[]>;
    });
    expect(exported["conversations"]).toHaveLength(1);
    expect(exported).toHaveProperty("conversation_messages");
    expect(exported).toHaveProperty("conversation_documents");
    await pool.query("delete from auth.users where id = $1", [carol]);
    const left = await pool.query("select 1 from conversations where id = $1", [chat]);
    expect(left.rowCount).toBe(0);
  });
});
