import { useAppState, useProfile, useReady } from "@/lib/useAppStore";
import { withBase } from "@/lib/base";
import { useEffect, useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTranslations } from "@/i18n";
import { activeChild, isSectionActive, mainNav, type NavItem } from "@/components/nav";
import { switchProfile } from "@/lib/store";
import { AppLinks } from "@/components/AppLinks";

/** Top-level section link with its sub-items always visible while expanded (sidebar-03 structure). */
function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isSectionActive(item, pathname);
  // The query (?id=…) is only known in the browser; until then no sub-item that needs one is marked.
  const [search, setSearch] = useState("");
  useEffect(() => setSearch(location.search), []);
  const current = activeChild(item, pathname, search);
  const activeClasses =
    "data-active:border-2 data-active:border-sidebar-border data-active:shadow-sticker";

  let button: React.ReactNode;
  if (collapsed && item.children) {
    // In the icon rail a section with children opens a dropdown instead of its page link.
    button = (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton isActive={active} tooltip={item.title} className={activeClasses}>
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent side="right" align="start" className="min-w-44">
          <DropdownMenuItem render={<a href={withBase(item.href)} />}>
            {item.title}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {item.children.map((child) => (
            <DropdownMenuItem key={child.href} render={<a href={withBase(child.href)} />}>
              {child.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else {
    button = (
      <SidebarMenuButton
        render={<a href={withBase(item.href)} />}
        isActive={active}
        tooltip={item.title}
        className={`font-medium ${activeClasses}`}
      >
        <item.icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuItem>
      {button}
      {item.badge ? (
        <SidebarMenuBadge className="border-sidebar-border bg-accent text-accent-foreground border font-mono">
          {item.badge}
        </SidebarMenuBadge>
      ) : null}
      {item.children && (
        <SidebarMenuSub className="border-l-2">
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.href}>
              <SidebarMenuSubButton
                render={<a href={withBase(child.href)} />}
                isActive={child.href === current}
                className="data-active:border-2 data-active:border-sidebar-border data-active:shadow-sticker-sm"
              >
                <span>{child.title}</span>
              </SidebarMenuSubButton>
              {child.badge ? (
                <SidebarMenuBadge className="border-sidebar-border bg-accent text-accent-foreground top-0.5 border font-mono">
                  {child.badge}
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/** The active profile's name and initials; a placeholder until mounted (matches the server render). */
function useProfileName() {
  const t = useTranslations();
  const ready = useReady();
  const state = useAppState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = state.profiles[state.activeProfile];
  const name = mounted && ready && current ? current.name : t("nav.profile");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return { name, initials, mounted: mounted && ready };
}

function ProfileAvatar({ initials }: { initials: string }) {
  return (
    <Avatar className="size-8 rounded-md border-2 border-border bg-secondary">
      <AvatarFallback className="rounded-md bg-transparent text-xs font-bold text-secondary-foreground">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

/** Profile switcher, Settings and About. */
function ProfileMenuContent({
  side,
  align,
  className,
}: {
  side: "top" | "bottom";
  align: "start" | "end";
  className?: string;
}) {
  const t = useTranslations();
  const state = useAppState();
  const { name, initials, mounted } = useProfileName();
  const profiles = Object.values(state.profiles);

  return (
    <DropdownMenuContent side={side} align={align} className={className ?? "w-56"}>
      {/* The label is a Menu.GroupLabel and must sit inside a group. */}
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-2">
          <ProfileAvatar initials={initials} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-semibold">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{t("profiles.title")}</span>
          </span>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      {mounted && profiles.length > 1 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {profiles.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => switchProfile(p.id)}>
                {p.id === state.activeProfile ? "✓ " : ""}
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem render={<a href={withBase("/settings")} />}>
        {t("nav.settings")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<a href={withBase("/about")} />}>{t("nav.about")}</DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function NavUser() {
  const t = useTranslations();
  const { name, initials } = useProfileName();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            tooltip={t("nav.profile")}
            className="data-open:bg-sidebar-accent"
          />
        }
      >
        <ProfileAvatar initials={initials} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{t("nav.profile")}</span>
        </span>
        <ChevronsUpDownIcon className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <ProfileMenuContent side="top" align="start" />
    </DropdownMenu>
  );
}

/** Phone header: the avatar alone opens the same profile menu (the sidebar is hidden there). */
export function ProfileButton({ className }: { className?: string }) {
  const t = useTranslations();
  const { name, initials } = useProfileName();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t("nav.profile")}: ${name}`}
        className={`rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
      >
        <ProfileAvatar initials={initials} />
      </DropdownMenuTrigger>
      <ProfileMenuContent side="bottom" align="end" />
    </DropdownMenu>
  );
}

/**
 * Lines still to buy on the shopping list. Read after mounting (localStorage), and the shopping module (with its
 * recipe data) is loaded lazily so it stays out of every page's first load.
 */
function useShoppingLeft(): number {
  const ready = useReady();
  const profile = useProfile();
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!ready) return;
    if (!profile.shopping.goals.length) return setLeft(0);
    let live = true;
    void Promise.all([import("@/lib/shopping"), import("@/lib/guide/builtin")]).then(
      ([{ shoppingList }, { findGuide }]) => {
        const list = shoppingList(profile.shopping, {
          chapter: 8,
          findGuide: (id) => findGuide(id, profile.guides),
        });
        if (live) setLeft(list.left);
      },
    );
    return () => {
      live = false;
    };
  }, [ready, profile.shopping, profile.guides]);
  return left;
}

/** The flat, always-visible app navigation (collapses to an icon rail). */
export function AppSidebar({ pathname }: { pathname: string }) {
  const t = useTranslations();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const shoppingLeft = useShoppingLeft();

  // The shopping list shows how many lines are still to buy.
  const items: NavItem[] = mainNav(t).map((item) => ({
    ...item,
    children: item.children?.map((c) =>
      c.href === "/tools/shopping" ? { ...c, badge: shoppingLeft } : c,
    ),
  }));

  return (
    <Sidebar collapsible="icon" className="border-r-2">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<a href={withBase("/")} />}
              tooltip={t("app.name")}
              className="font-medium"
            >
              <img src={withBase("/logo.svg")} alt="" className="size-8 shrink-0" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-semibold">{t("app.short")}</span>
                <span className="truncate text-xs text-muted-foreground">{t("app.tagline")}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <AppLinks className="justify-end group-data-[collapsible=icon]:flex-col" />
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
