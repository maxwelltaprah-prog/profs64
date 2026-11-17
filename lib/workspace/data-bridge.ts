// The page side of the data store. The sandboxed preview frame cannot reach the network, so its
// db helper posts a request here; this checks it against a fixed whitelist and calls the project's
// own API with the signed-in person's session. The frame is only ever trusted to say what it
// wants, never where to send it: the project id comes from the page, not the message.

export interface DataRequest {
  id: string;
  op: "list" | "create" | "update" | "remove";
  collection: string;
  recordId?: string;
  data?: Record<string, unknown>;
}

export interface DataReply {
  type: "buildr-data-result";
  id: string;
  ok: boolean;
  code?: string;
  message?: string;
  result?: unknown;
}

const COLLECTION = /^[a-z0-9_-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPS = new Set(["list", "create", "update", "remove"]);
const MAX_BYTES = 16 * 1024;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Returns the cleaned request, or null if the message is not a well-formed data request.
export function parseDataRequest(raw: unknown): DataRequest | null {
  if (!isPlainObject(raw) || raw["type"] !== "buildr-data") return null;
  const { id, op, collection, recordId, data } = raw;
  if (typeof id !== "string" || id.length > 20) return null;
  if (typeof op !== "string" || !OPS.has(op)) return null;
  if (typeof collection !== "string" || !COLLECTION.test(collection)) return null;
  const request: DataRequest = { id, op: op as DataRequest["op"], collection };
  if (op === "update" || op === "remove") {
    if (typeof recordId !== "string" || !UUID.test(recordId)) return null;
    request.recordId = recordId;
  }
  if (op === "create" || op === "update") {
    if (!isPlainObject(data)) return null;
    let size: number;
    try {
      size = new TextEncoder().encode(JSON.stringify(data)).length;
    } catch {
      return null;
    }
    if (size > MAX_BYTES) return null;
    request.data = data;
  }
  return request;
}

export async function runDataRequest(
  projectId: string | null,
  request: DataRequest,
  fetcher: typeof fetch = fetch,
): Promise<DataReply> {
  const reply = (fields: Omit<DataReply, "type" | "id">): DataReply => ({
    type: "buildr-data-result",
    id: request.id,
    ...fields,
  });
  // A shared preview has no owner session: the helper falls back to this browser's own storage.
  if (!projectId) return reply({ ok: false, code: "unavailable" });
  const base = `/api/projects/${projectId}/data/${request.collection}`;
  const url = request.recordId ? `${base}/${request.recordId}` : base;
  const method = { list: "GET", create: "POST", update: "PUT", remove: "DELETE" }[request.op];
  try {
    const response = await fetcher(url, {
      method,
      ...(request.data
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(request.data) }
        : {}),
    });
    if (response.status === 204) return reply({ ok: true, result: null });
    const body = (await response.json().catch(() => null)) as {
      records?: unknown;
      record?: unknown;
      error?: { code?: string; message?: string };
    } | null;
    if (response.ok) return reply({ ok: true, result: body?.records ?? body?.record ?? null });
    if (body?.error?.code === "database_update_needed") {
      return reply({ ok: false, code: "unavailable" });
    }
    return reply({
      ok: false,
      code: body?.error?.code ?? "error",
      message: body?.error?.message ?? "The data store could not do that.",
    });
  } catch {
    return reply({ ok: false, code: "unavailable" });
  }
}
