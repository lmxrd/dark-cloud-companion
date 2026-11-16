import { useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useViewToggles, ViewToggles } from "./ViewToggles";
import type { StepFilters } from "@/components/guide/StepCard";
import { useTranslations } from "@/i18n";
import { chapterById } from "@/lib/data";
import { firstIncompleteChapter } from "@/lib/guide/dashboard";
import type { DashboardView } from "@/lib/profiles";
import { stripBase, withBase } from "@/lib/base";
import { navigate, usePathname, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { dashboardPath, parseDashboardPath, type DashboardRoute } from "./route";
import { ByGuideView } from "./ByGuideView";
import { ChapterView, FilterBar } from "./ChapterView";
import { OverviewView } from "./OverviewView";
import { useActiveGuides } from "./useActiveGuides";

const views: DashboardView[] = ["chapter", "overview", "byGuide"];

const isChapter = (id: string) => chapterById.has(id);

function DashboardInner({ path }: { path: string }) {
  const t = useTranslations();
  const { profile, checks, guides } = useActiveGuides();
  // The view and the chapter are the path (`/overview`, `/chapters/3`), the search is `?q=`.
  const pathname = stripBase(usePathname(withBase(path)));
  const route = parseDashboardPath(pathname, isChapter);
  const [needle, setNeedle] = useQueryText("q");
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();

  // Switching back to the chapter tab returns to the chapter last looked at on this page.
  const lastChapter = useRef(route.chapter);
  if (route.chapter) lastChapter.current = route.chapter;
  const go = (to: DashboardRoute) => {
    const q = needle ? `?q=${encodeURIComponent(needle)}` : "";
    navigate(withBase(dashboardPath(to)) + q);
  };
  const viewChapter = route.chapter;
  const view = route.view;

  const currentId = profile.dashboard.currentChapter ?? firstIncompleteChapter(guides, checks);
  const chapterId = viewChapter ?? currentId;
  const filters: StepFilters = {
    hideDone: profile.view.hideDone,
    hidePostgame: profile.view.hidePostgame,
    showFacts: profile.view.showFacts,
    buyableOnly: profile.view.buyableOnly,
    needle: needle.trim().toLowerCase(),
  };

  const openChapter = (id: string) => go({ view: "chapter", chapter: id });
  const openView = (v: DashboardView) =>
    go({ view: v, chapter: v === "chapter" ? lastChapter.current : null });

  const { activeCount: activeToggles } = useViewToggles();
  const canSearch = view !== "overview";

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">{t("nav.dashboard")}</h1>
      <div className="flex items-center gap-1.5">
        <div
          role="tablist"
          aria-label={t("dash.viewsLabel")}
          className="bg-muted/60 flex min-w-0 flex-1 rounded-lg border-2 p-0.5 sm:flex-none"
        >
          {views.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => openView(v)}
              className={`min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:flex-none sm:text-sm ${view === v ? "bg-card shadow-sticker-sm border-2" : "text-muted-foreground border-2 border-transparent"}`}
            >
              {v === "chapter" ? (
                <>
                  <span className="sm:hidden">{t("dash.views.chapterShort")}</span>
                  <span className="hidden sm:inline">{t("dash.views.chapter")}</span>
                </>
              ) : (
                t(`dash.views.${v}` as const)
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 gap-1.5">
          {canSearch && (
            <Button
              variant="outline"
              size="icon"
              aria-label={t("dash.search")}
              aria-pressed={searchOpen || needle !== ""}
              onClick={() => setSearchOpen((o) => !o)}
            >
              <SearchIcon />
            </Button>
          )}
          <Sheet>
            <SheetTrigger
              render={<Button variant="outline" size="icon" className="relative" />}
              aria-label={t("dash.viewMenu")}
            >
              <SlidersHorizontalIcon />
              {activeToggles > 0 && (
                <span
                  aria-hidden
                  className="bg-accent text-accent-foreground absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border-2 text-[10px] font-bold tabular-nums"
                >
                  {activeToggles}
                </span>
              )}
            </SheetTrigger>
            <SheetContent
              side={isMobile ? "bottom" : "right"}
              className="gap-2 pb-[env(safe-area-inset-bottom)]"
            >
              <SheetHeader>
                <SheetTitle>{t("dash.viewMenu")}</SheetTitle>
              </SheetHeader>
              <ViewToggles className="px-4 pb-4" />
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {canSearch && (searchOpen || needle !== "") && (
        <FilterBar needle={needle} onNeedle={setNeedle} />
      )}

      {view === "chapter" && (
        <ChapterView
          guides={guides}
          profile={profile}
          checks={checks}
          chapterId={chapterId}
          currentId={currentId}
          onChapter={openChapter}
          filters={filters}
        />
      )}
      {view === "overview" && (
        <OverviewView
          guides={guides}
          checks={checks}
          currentId={currentId}
          onChapter={openChapter}
        />
      )}
      {view === "byGuide" && <ByGuideView guides={guides} checks={checks} filters={filters} />}
    </div>
  );
}

/** `path` is the page's base-less path (the server render can't see the URL otherwise). */
export function Dashboard({ path }: { path: string }) {
  const t = useTranslations();
  return (
    <ErrorBoundary label={t("error.dashboard")}>
      {/* Hidden until saved progress and the query are applied, so the defaults never flash. */}
      <Gate on={["url", "state"]}>
        <DashboardInner path={path} />
      </Gate>
    </ErrorBoundary>
  );
}
