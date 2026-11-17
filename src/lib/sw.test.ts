import { beforeEach, describe, expect, test } from "vitest";
import { $updateWaiting, applyUpdate, watchForUpdates } from "./sw";

type Listener = () => void;

/** A minimal ServiceWorker / registration pair that tests can move through states. */
function fakeWorker() {
  const listeners: Listener[] = [];
  const messages: unknown[] = [];
  return {
    state: "installing",
    messages,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    postMessage: (m: unknown) => messages.push(m),
    install() {
      this.state = "installed";
      for (const fn of listeners) fn();
    },
  };
}

function fakeRegistration(waiting: ReturnType<typeof fakeWorker> | null = null) {
  const listeners: Listener[] = [];
  return {
    waiting,
    installing: null as ReturnType<typeof fakeWorker> | null,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    found(w: ReturnType<typeof fakeWorker>) {
      this.installing = w;
      for (const fn of listeners) fn();
    },
  };
}

const asReg = (r: unknown) => r as ServiceWorkerRegistration;
const container = (controlled: boolean) =>
  ({ controller: controlled ? {} : null }) as unknown as ServiceWorkerContainer;

describe("service worker updates", () => {
  beforeEach(() => $updateWaiting.set(null));

  test("a version found installing is offered once it has installed", () => {
    const reg = fakeRegistration();
    watchForUpdates(asReg(reg), container(true));
    const next = fakeWorker();
    reg.found(next);
    expect($updateWaiting.get()).toBeNull();
    next.install();
    expect($updateWaiting.get()).toBe(next);
  });

  test("a version already waiting is offered right away", () => {
    const next = fakeWorker();
    next.state = "installed";
    watchForUpdates(asReg(fakeRegistration(next)), container(true));
    expect($updateWaiting.get()).toBe(next);
  });

  test("the first install is not an update", () => {
    const reg = fakeRegistration();
    watchForUpdates(asReg(reg), container(false));
    const first = fakeWorker();
    reg.found(first);
    first.install();
    expect($updateWaiting.get()).toBeNull();
  });

  test("applying asks the waiting version to take over", () => {
    const next = fakeWorker();
    $updateWaiting.set(next as unknown as ServiceWorker);
    applyUpdate();
    expect(next.messages).toEqual([{ type: "SKIP_WAITING" }]);
  });
});
