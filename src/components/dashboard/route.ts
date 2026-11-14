import type { DashboardView } from "@/lib/profiles";

/** The dashboard's views and chapters are paths, so a reload or a link lands on the same view. */
export type DashboardRoute = { view: DashboardView; chapter: string | null };

const VIEW_PATHS: Record<DashboardView, string> = {
  chapter: "/",
  overview: "/overview",
  byGuide: "/by-guide",
};

/** Top-level path segments that belong to the dashboard (besides "/"). */
export const DASHBOARD_SEGMENTS = ["overview", "by-guide", "chapters"] as const;

/** The path of a view; the chapter view with a chapter is `/chapters/<id>`. */
export const dashboardPath = ({ view, chapter }: DashboardRoute) =>
  view === "chapter" && chapter ? `/chapters/${chapter}` : VIEW_PATHS[view];

/**
 * Reads a base-less pathname. `search` covers older `/?chapter=<id>` links, and old chapter keys
 * (`c3`) still resolve. Unknown chapters fall
 * back to following progress.
 */
export function parseDashboardPath(
  pathname: string,
  search: string,
  isChapter: (id: string) => boolean,
): DashboardRoute {
  const [head, sub] = pathname.replace(/^\/|\/$/g, "").split("/");
  if (head === "overview") return { view: "overview", chapter: null };
  if (head === "by-guide") return { view: "byGuide", chapter: null };
  const raw = head === "chapters" ? sub : new URLSearchParams(search).get("chapter");
  // Chapter keys used to be "c1"…"c8" and "postgame" (now chapter 8).
  const id = raw === "postgame" ? "8" : raw?.replace(/^c(\d)$/, "$1");
  return { view: "chapter", chapter: id && isChapter(id) ? id : null };
}
