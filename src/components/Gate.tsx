import { useSyncExternalStore, type ReactNode } from "react";
import { useReady } from "@/lib/useAppStore";

const noop = () => () => {};
/** False on the server and while hydrating, true afterwards. */
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * Keeps its content hidden, on visits where it matters, until the island has applied what the
 * server render could not know: the URL query (`url`) and/or the saved progress (`state`). Plain
 * visits paint immediately. See `global.css` and the inline script in `Layout.astro`.
 */
export function Gate({
  on,
  className,
  children,
}: {
  on: ("url" | "state")[];
  className?: string;
  children: ReactNode;
}) {
  const hydrated = useHydrated();
  const ready = useReady();
  const done = hydrated && (!on.includes("state") || ready);
  return (
    <div className={className} data-gate={on.join(" ")} data-ready={done ? "" : undefined}>
      {children}
    </div>
  );
}
