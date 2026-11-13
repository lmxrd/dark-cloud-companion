import {
  BookOpenIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  RouteIcon,
  type LucideIcon,
} from "lucide-react";
import type { Translate } from "@/i18n";
import { MAIN_GUIDE_ID } from "@/lib/guide/main";

export type NavChild = { title: string; href: string };
export type NavItem = { title: string; href: string; icon: LucideIcon; children?: NavChild[] };

/** The Reference sub-pages, by their top-level path segment. */
export const REFERENCE_PAGES = ["weapons", "items", "ridepod", "monsters", "spheda"] as const;

/** The four main sections: the sidebar on wide screens, the bottom tab bar on phones. */
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
    { title: t("nav.planner"), href: "/planner", icon: RouteIcon },
    {
      title: t("nav.reference"),
      href: "/reference",
      icon: DatabaseIcon,
      children: REFERENCE_PAGES.map((page) => ({
        title: t(`nav.${page}` as const),
        href: `/${page}`,
      })),
    },
  ];
}

export const isActive = (href: string, pathname: string) => {
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
};

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
  if (!head) return [{ label: t("nav.dashboard") }];

  const label =
    {
      guides: t("nav.guides"),
      planner: t("nav.planner"),
      reference: t("nav.reference"),
      settings: t("nav.settings"),
      about: t("nav.about"),
      ...Object.fromEntries(REFERENCE_PAGES.map((p) => [p, t(`nav.${p}` as const)])),
    }[head] ?? head;

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
