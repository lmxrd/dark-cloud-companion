import {
  BookOpenIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import type { Translate } from "@/i18n";
import { MAIN_GUIDE_ID } from "@/lib/guide/main";
import { DASHBOARD_SEGMENTS } from "@/components/dashboard/route";

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

/** The Reference sub-pages, by their top-level path segment. */
export const REFERENCE_PAGES = ["weapons", "items", "ridepod", "monsters", "spheda"] as const;

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
      title: t("nav.reference"),
      href: "/reference",
      icon: DatabaseIcon,
      children: REFERENCE_PAGES.map((page) => ({
        title: t(`nav.${page}` as const),
        href: `/${page}`,
      })),
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

/**
 * Breadcrumb from the pathname: sub-pages get their section as the first crumb, and a detail page
 * (a weapon) gets its list page in between. `page` names the current page when the path can't.
 */
export function crumbsFor(t: Translate, pathname: string, page?: string): Crumb[] {
  const [head, sub] = pathname.replace(/^\/|\/$/g, "").split("/");
  if (!head || (DASHBOARD_SEGMENTS as readonly string[]).includes(head))
    return [{ label: t("nav.dashboard") }];

  const label =
    {
      guides: t("nav.guides"),
      tools: t("nav.tools"),
      reference: t("nav.reference"),
      settings: t("nav.settings"),
      about: t("nav.about"),
      ...Object.fromEntries(REFERENCE_PAGES.map((p) => [p, t(`nav.${p}` as const)])),
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
  if ((REFERENCE_PAGES as readonly string[]).includes(head)) {
    const reference = { label: t("nav.reference"), href: "/reference" };
    return sub
      ? [reference, { label, href: `/${head}` }, { label: page ?? sub }]
      : [reference, { label }];
  }
  return [{ label }];
}
