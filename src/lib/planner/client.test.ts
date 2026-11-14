import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/** A stand-in Worker that records messages and lets the test fail it. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(m: unknown) {
    this.posted.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  fail() {
    this.onerror?.({ preventDefault() {} } as ErrorEvent);
  }
}

describe("planner client", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("a worker that fails to load rejects every pending request instead of hanging", async () => {
    const { runPlanner, loadTemplates, WORKER_FAILED } = await import("./client");
    const plan = runPlanner({} as never);
    const templates = loadTemplates({} as never);
    FakeWorker.instances[0].fail();
    await expect(plan).rejects.toThrow(WORKER_FAILED);
    await expect(templates).rejects.toThrow(WORKER_FAILED);
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });

  test("the next request after a failure starts a fresh worker", async () => {
    const { runPlanner } = await import("./client");
    const first = runPlanner({} as never);
    FakeWorker.instances[0].fail();
    await expect(first).rejects.toThrow();
    void runPlanner({} as never).catch(() => {});
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[1].posted).toHaveLength(1);
  });

  test("results resolve their own request", async () => {
    const { runPlanner } = await import("./client");
    const p = runPlanner({} as never);
    const w = FakeWorker.instances[0];
    const { id } = w.posted[0] as { id: number };
    w.onmessage?.({ data: { id, result: { status: "ok" } } } as MessageEvent);
    await expect(p).resolves.toEqual({ status: "ok" });
  });
});
