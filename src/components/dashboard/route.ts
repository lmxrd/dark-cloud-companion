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

/** Reads a base-less pathname. Unknown chapters fall back to following progress. */
export function parseDashboardPath(
  pathname: string,
  isChapter: (id: string) => boolean,
): DashboardRoute {
  const [head, sub] = pathname.replace(/^\/|\/$/g, "").split("/");
  if (head === "overview") return { view: "overview", chapter: null };
  if (head === "by-guide") return { view: "byGuide", chapter: null };
  const id = head === "chapters" ? sub : undefined;
  return { view: "chapter", chapter: id && isChapter(id) ? id : null };
}
