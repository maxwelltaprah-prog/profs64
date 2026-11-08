import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchForStop } from "@/lib/ai/stop-watch";
import { latestStopId, stopRequestedSince } from "@/lib/db/stop";

const clientWith = (result: { data: unknown; error: unknown }) => {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "gt", "order"]) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return chain;
    };
  }
  chain["limit"] = async () => result;
  return { client: { from: () => chain } as never, calls };
};

describe("stop queries", () => {
  it("reads the newest stop id for the project, 0 when none or on error", async () => {
    const found = clientWith({ data: [{ id: 41 }], error: null });
    expect(await latestStopId("p", found.client)).toBe(41);
    expect(found.calls).toContainEqual(["eq", ["event", "chat_stop"]]);
    expect(found.calls).toContainEqual(["eq", ["metadata->>projectId", "p"]]);
    expect(await latestStopId("p", clientWith({ data: [], error: null }).client)).toBe(0);
    expect(await latestStopId("p", clientWith({ data: null, error: { code: "x" } }).client)).toBe(
      0,
    );
  });

  it("sees only events newer than the baseline, and treats a failed read as no stop", async () => {
    const found = clientWith({ data: [{ id: 42 }], error: null });
    expect(await stopRequestedSince("p", 41, found.client)).toBe(true);
    expect(found.calls).toContainEqual(["gt", ["id", 41]]);
    expect(await stopRequestedSince("p", 41, clientWith({ data: [], error: null }).client)).toBe(
      false,
    );
    expect(
      await stopRequestedSince("p", 41, clientWith({ data: null, error: { code: "x" } }).client),
    ).toBe(false);
  });
});

describe("watchForStop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls onStop once when the check turns true, then stops checking", async () => {
    const check = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const onStop = vi.fn();
    watchForStop(check, onStop, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStop).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(check).toHaveBeenCalledTimes(2);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("ignores a failing check, never overlaps checks, and ends when told to", async () => {
    let release: () => void = () => undefined;
    const slow = vi.fn(() => new Promise<boolean>((resolve) => (release = () => resolve(false))));
    const onStop = vi.fn();
    const end = watchForStop(slow, onStop, 1000);
    await vi.advanceTimersByTimeAsync(3500);
    expect(slow).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(slow).toHaveBeenCalledTimes(2);
    end();
    await vi.advanceTimersByTimeAsync(5000);
    expect(slow).toHaveBeenCalledTimes(2);

    const failing = vi.fn().mockRejectedValue(new Error("db down"));
    watchForStop(failing, onStop, 1000)();
    expect(onStop).not.toHaveBeenCalled();
  });
});
