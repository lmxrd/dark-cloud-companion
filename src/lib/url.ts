/**
 * Navigation state in the URL. Views that should survive a reload or be linkable (tabs, the chapter
 * shown, list filters) live in the path or the query, not in component state.
 *
 * Pages are prerendered, so the server render never sees the query: islands render their defaults
 * first and pick the URL up right after hydration. `<UrlGate>` hides them until then on visits that
 * carry a query (see the inline script in `Layout.astro`), so the defaults never flash.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") window.addEventListener("popstate", notify);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/**
 * Moves to another URL of the app without a reload. `replace` doesn't add a Back step (use it for
 * typing and other fine-grained changes).
 */
export function navigate(href: string | URL, { replace = false } = {}) {
  const url = new URL(href, location.href);
  if (url.href === location.href) return;
  if (replace) history.replaceState(history.state, "", url);
  else history.pushState(null, "", url);
  notify();
}

/** Sets query parameters; `null`, `undefined` and `""` remove one. */
export function setQuery(
  params: Record<string, string | null | undefined>,
  opts?: { replace?: boolean },
) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  navigate(url, opts);
}

/** The current `pathname + search`, re-rendering on navigation. `server` while hydrating. */
export function useHref(server = ""): string {
  return useSyncExternalStore(
    subscribe,
    () => location.pathname + location.search,
    () => server,
  );
}

/** The current pathname, re-rendering on navigation. `server` while hydrating. */
export function usePathname(server: string): string {
  return useSyncExternalStore(
    subscribe,
    () => location.pathname,
    () => server,
  );
}

/** One query parameter ("" when absent), re-rendering on navigation. "" while hydrating. */
export function useQueryParam(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(location.search).get(key) ?? "",
    () => "",
  );
}

/** Reads a query parameter once, for client-only islands (they never render on the server). */
export const queryParam = (key: string): string | null =>
  typeof location === "undefined" ? null : new URLSearchParams(location.search).get(key);

/**
 * A search box backed by a query parameter: the text updates at once, the URL a moment after typing
 * stops (browsers limit how often the URL may change). Back/forward and hydration update the text.
 */
export function useQueryText(key: string, delay = 300): [string, (text: string) => void] {
  const fromUrl = useQueryParam(key);
  const [text, setText] = useState(fromUrl);
  const [seen, setSeen] = useState(fromUrl);
  if (fromUrl !== seen) {
    setSeen(fromUrl);
    setText(fromUrl);
  }
  useEffect(() => {
    if (text === fromUrl) return;
    const timer = setTimeout(() => setQuery({ [key]: text }, { replace: true }), delay);
    return () => clearTimeout(timer);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return [text, setText];
}

/** A query parameter limited to known values; anything else reads as `fallback`. */
export function useQueryChoice<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const raw = useQueryParam(key);
  const value = (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
  // The default stays out of the URL.
  const set = (v: T) => setQuery({ [key]: v === fallback ? null : v }, { replace: true });
  return [value, set];
}
