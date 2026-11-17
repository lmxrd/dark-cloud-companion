import { useSyncExternalStore } from "react";
import type { ReadableAtom } from "nanostores";
import { $checks, $profile, $ready, $state, $storageProblem, SERVER_STATE } from "./store";

const SERVER_PROFILE = SERVER_STATE.profiles[SERVER_STATE.activeProfile];

/**
 * Like `useStore`, but React renders `server` on the server and while hydrating, then switches to the
 * store's value. The stored state comes from localStorage, which the server can't see; without this
 * every island showing saved progress fails to hydrate.
 */
export function useHydrationSafe<T>(store: ReadableAtom<T>, server: T): T {
  return useSyncExternalStore(
    (onChange) => store.listen(onChange),
    () => store.get(),
    () => server,
  );
}

export const useAppState = () => useHydrationSafe($state, SERVER_STATE);
export const useProfile = () => useHydrationSafe($profile, SERVER_PROFILE);
export const useChecks = () => useHydrationSafe($checks, SERVER_PROFILE.checks);
/** True once the stored state is in use (false on the server and while hydrating). */
export const useReady = () => useHydrationSafe($ready, false);

/** A problem with what is stored in this browser (never on the server). */
export const useStorageProblem = () => useHydrationSafe($storageProblem, null);
