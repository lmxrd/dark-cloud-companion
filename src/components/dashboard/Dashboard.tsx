import { useEffect, useState } from "react";
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
import { setDashboardView } from "@/lib/store";
import { ByGuideView } from "./ByGuideView";
import { ChapterView, FilterBar } from "./ChapterView";
import { OverviewView } from "./OverviewView";
import { useActiveGuides } from "./useActiveGuides";

const views: DashboardView[] = ["chapter", "overview", "byGuide"];

function DashboardInner() {
  const t = useTranslations();
  const { profile, checks, guides } = useActiveGuides();
  const [needle, setNeedle] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewChapter, setViewChapter] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // A chapter can be requested with ?chapter=c3 (e.g. from redirected old links).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("chapter");
    if (id && chapterById.has(id)) setViewChapter(id);
  }, []);

  const currentId = profile.dashboard.currentChapter ?? firstIncompleteChapter(guides, checks);
  const chapterId = viewChapter ?? currentId;
  const filters: StepFilters = {
    hideDone: profile.view.hideDone,
    hidePostgame: profile.view.hidePostgame,
    showFacts: profile.view.showFacts,
    buyableOnly: profile.view.buyableOnly,
    needle: needle.trim().toLowerCase(),
  };

  const openChapter = (id: string) => {
    setViewChapter(id);
    setDashboardView("chapter");
  };

  const { activeCount: activeToggles } = useViewToggles();
  const canSearch = profile.dashboard.view !== "overview";

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
              aria-selected={profile.dashboard.view === v}
              onClick={() => setDashboardView(v)}
              className={`min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:flex-none sm:text-sm ${profile.dashboard.view === v ? "bg-card shadow-sticker-sm border-2" : "text-muted-foreground border-2 border-transparent"}`}
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
        <FilterBar filters={filters} needle={needle} onNeedle={setNeedle} />
      )}

      {profile.dashboard.view === "chapter" && (
        <ChapterView
          guides={guides}
          profile={profile}
          checks={checks}
          chapterId={chapterId}
          currentId={currentId}
          onChapter={setViewChapter}
          filters={filters}
        />
      )}
      {profile.dashboard.view === "overview" && (
        <OverviewView
          guides={guides}
          checks={checks}
          currentId={currentId}
          onChapter={openChapter}
        />
      )}
      {profile.dashboard.view === "byGuide" && (
        <ByGuideView guides={guides} checks={checks} filters={filters} />
      )}
    </div>
  );
}

export function Dashboard() {
  return (
    <ErrorBoundary label="the dashboard">
      <DashboardInner />
    </ErrorBoundary>
  );
}
