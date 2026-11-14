import { Fragment, useEffect, useState, type ReactNode } from "react";
import { cn } from "cn";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar, ProfileButton } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { StorageBanner } from "@/components/StorageBanner";
import { crumbsFor } from "@/components/nav";
import { withBase } from "@/lib/base";
import { useTranslations } from "@/i18n";

function AppHeader({ pathname, page }: { pathname: string; page?: string }) {
  const t = useTranslations();
  const { state } = useSidebar();
  const crumbs = crumbsFor(t, pathname, page);
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2 px-4 transition-[height] duration-200 ease-linear",
        state === "collapsed" ? "h-12" : "h-16",
      )}
    >
      {/* Phones navigate with the bottom tab bar instead of the sidebar sheet. */}
      <SidebarTrigger className="hidden md:inline-flex" />
      <Separator
        orientation="vertical"
        className="hidden data-vertical:h-4 data-vertical:self-center md:block"
      />
      <a href={withBase("/")} className="shrink-0 md:hidden" aria-label={t("app.name")}>
        <img src={withBase("/logo.svg")} alt="" className="size-7" />
      </a>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.href && i < crumbs.length - 1 ? (
                  <BreadcrumbLink render={<a href={withBase(crumb.href)} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <ProfileButton className="ml-auto md:hidden" />
    </header>
  );
}

/**
 * Sidebar shell around every page: flat sidebar (icon rail when collapsed, sheet on mobile), a
 * slim header with a breadcrumb, and the plain page area.
 */
export function AppShell({
  pathname,
  page,
  children,
}: {
  pathname: string;
  /** The current page's name for the breadcrumb, when the path doesn't say it (a weapon's id). */
  page?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    // The sidebar persists its state in a cookie, but a static site can only read it on the client.
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/);
    if (match) setOpen(decodeURIComponent(match[1]) !== "false");
  }, []);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar pathname={pathname} />
      <SidebarInset>
        <AppHeader pathname={pathname} page={page} />
        {/* On phones, leave room for the fixed tab bar and the home indicator below it. */}
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
          <StorageBanner />
          {children}
        </div>
        <BottomNav pathname={pathname} />
      </SidebarInset>
    </SidebarProvider>
  );
}
