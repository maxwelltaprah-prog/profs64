import { vi } from "vitest";

// `server-only` throws outside a React Server environment by design; neutralize it for unit tests.
vi.mock("server-only", () => ({}));
