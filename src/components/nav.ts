import {
  BookOpenIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import type { Translate } from "@/i18n";
import { MAIN_GUIDE_ID } from "@/lib/guide/types";
import { DASHBOARD_SEGMENTS } from "@/components/dashboard/route";
import { DB_KINDS, DB_LISTS, type DbList } from "@/lib/db/routes";

export type NavChild = {
  title: string;
  href: string;
  /** A count shown next to it (e.g. shopping lines left). */
  badge?: number;
};
export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
  /** A count shown next to the item (e.g. shopping lines left). */
  badge?: number;
};

/** The database list pages, under /db/. */
export const DB_PAGES = DB_LISTS;

/** The Tools pages, under /tools/. */
export const TOOL_PAGES = ["planner", "shopping", "spheres"] as const;

/** The main sections: the sidebar on wide screens, the bottom tab bar on phones. */
export function mainNav(t: Translate): NavItem[] {
  return [
    { title: t("nav.dashboard"), href: "/", icon: LayoutDashboardIcon },
    {
      title: t("nav.guides"),
      href: "/guides",
      icon: BookOpenIcon,
      children: [
        { title: t("nav.main"), href: `/guides/view?id=${MAIN_GUIDE_ID}` },
        { title: t("guides.custom"), href: "/guides" },
      ],
    },
    {
      title: t("nav.tools"),
      href: "/tools",
      icon: WrenchIcon,
      children: TOOL_PAGES.map((page) => ({
        title: t(`nav.${page}` as const),
        href: `/tools/${page}`,
      })),
    },
    {
      title: t("nav.db"),
      href: "/db",
      icon: DatabaseIcon,
      children: DB_LISTS.map((page) => ({
        title: t(`nav.${page}` as const),
        href: `/db/${page}`,
      })),
    },
  ];
}

/** "/" and the dashboard's other views (`/overview`, `/chapters/3`, …). */
const isDashboardPath = (pathname: string) =>
  pathname === "/" ||
  (DASHBOARD_SEGMENTS as readonly string[]).includes(pathname.split("/")[1] ?? "");

export const isActive = (href: string, pathname: string) => {
  const path = href.split("?")[0];
  return path === "/"
    ? isDashboardPath(pathname)
    : pathname === path || pathname.startsWith(`${path}/`);
};

/**
 * The sub-item to mark for the current page: the most specific path match, and for sub-items with a
 * query (`/guides/view?id=main`) only when the page's query matches too. `search` is only known in
 * the browser; pass "" on the server.
 */
export function activeChild(item: NavItem, pathname: string, search: string): string | undefined {
  pathname = dbNavPath(pathname);
  const path = (href: string) => href.split("?")[0];
  const matches = (item.children ?? []).filter((c) => isActive(c.href, pathname));
  if (!matches.length) return undefined;
  const longest = Math.max(...matches.map((c) => path(c.href).length));
  const params = new URLSearchParams(search);
  return matches
    .filter((c) => path(c.href).length === longest)
    .find((c) => {
      const query = c.href.split("?")[1];
      return !query || [...new URLSearchParams(query)].every(([k, v]) => params.get(k) === v);
    })?.href;
}

/** A section is active on its own page and on any of its sub-pages. */
export const isSectionActive = (item: NavItem, pathname: string) =>
  isActive(item.href, pathname) || (item.children ?? []).some((c) => isActive(c.href, pathname));

export type Crumb = { label: string; href?: string };

/** The database list a /db path belongs to (`/db/towns/x` → `places`). */
export function dbListOf(pathname: string): DbList | undefined {
  const [head, seg] = pathname.replace(/^\/|\/$/g, "").split("/");
  if (head !== "db" || !seg) return undefined;
  if ((DB_LISTS as readonly string[]).includes(seg)) return seg as DbList;
  return Object.values(DB_KINDS).find((k) => k.segment === seg)?.list;
}

/** A /db page's path as its list's (`/db/towns/x` → `/db/places/x`), for marking the menu. */
const dbNavPath = (pathname: string) => {
  const list = dbListOf(pathname);
  if (!list) return pathname;
  const parts = pathname.replace(/^\/|\/$/g, "").split("/");
  return "/" + ["db", list, ...parts.slice(2)].join("/");
};

/**
 * Breadcrumb from the pathname: sub-pages get their section as the first crumb, and a detail page
 * (a weapon) gets its list page in between. `page` names the current page when the path can't.
 */
export function crumbsFor(
  t: Translate,
  pathname: string,
  page?: string,
  parents: Crumb[] = [],
): Crumb[] {
  const [head, sub, ...rest] = pathname.replace(/^\/|\/$/g, "").split("/");
  if (head === "db") {
    const home = { label: t("nav.db"), href: "/db" };
    const list = dbListOf(pathname);
    if (!sub || !list) return [{ label: t("nav.db") }];
    const listLabel = t(`nav.${list}` as const);
    return sub === list && !rest.length
      ? [home, { label: listLabel }]
      : [
          home,
          { label: listLabel, href: `/db/${list}` },
          ...parents,
          { label: page ?? rest.at(-1) ?? sub },
        ];
  }
  if (!head || (DASHBOARD_SEGMENTS as readonly string[]).includes(head))
    return [{ label: t("nav.dashboard") }];

  const label =
    {
      guides: t("nav.guides"),
      tools: t("nav.tools"),
      settings: t("nav.settings"),
      about: t("nav.about"),
    }[head] ?? head;

  if (head === "tools" && sub)
    return (TOOL_PAGES as readonly string[]).includes(sub)
      ? [
          { label, href: "/tools" },
          { label: t(`nav.${sub as (typeof TOOL_PAGES)[number]}` as const) },
        ]
      : [{ label, href: "/tools" }];
  if (head === "guides" && sub === "view")
    return [{ label, href: "/guides" }, { label: page ?? t("nav.guide") }];
  return [{ label }];
}
