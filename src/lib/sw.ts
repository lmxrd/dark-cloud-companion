import { atom } from "nanostores";

/**
 * A newer service worker that has installed and is waiting to take over. The app shows an "update
 * available" prompt while this is set; `applyUpdate` swaps it in and reloads.
 */
export const $updateWaiting = atom<ServiceWorker | null>(null);

/** Watches a registration for a new version that is installed but not yet in charge. */
export function watchForUpdates(reg: ServiceWorkerRegistration, container: ServiceWorkerContainer) {
  // Only an update when a version is already in charge; the very first install just activates.
  const offer = (w: ServiceWorker | null) => {
    if (w && container.controller) $updateWaiting.set(w);
  };
  offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const next = reg.installing;
    next?.addEventListener("statechange", () => {
      if (next.state === "installed") offer(next);
    });
  });
}

/** Lets the waiting version take over; every open tab reloads when it does (see `register`). */
export function applyUpdate() {
  $updateWaiting.get()?.postMessage({ type: "SKIP_WAITING" });
}

/** Registers the service worker, offers updates, and reloads tabs when a new version takes over. */
export async function registerServiceWorker(url: string) {
  if (!("serviceWorker" in navigator)) return;
  const container = navigator.serviceWorker;
  // A tab still running the old version would load files the new version has deleted: reload when a
  // new version takes over from a previous one. Not when the very first install claims the page.
  let current = container.controller;
  let reloading = false;
  container.addEventListener("controllerchange", () => {
    const hadOne = !!current;
    current = container.controller;
    if (!hadOne || reloading) return;
    reloading = true;
    location.reload();
  });
  try {
    const reg = await container.register(url);
    watchForUpdates(reg, container);
    // Long-lived tabs (an installed app left open) check again whenever they come back.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
  } catch {}
}
