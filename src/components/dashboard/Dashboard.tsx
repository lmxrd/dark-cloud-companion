import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StepFilters } from "@/components/guide/StepCard";
import { useTranslations } from "@/i18n";
import { chapterById } from "@/lib/data";
import { firstIncompleteChapter } from "@/lib/guide/dashboard";
import type { DashboardView } from "@/lib/profiles";
import { setDashboardView, setView } from "@/lib/store";
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

  const toggles = [
    { key: "showFacts", label: t("view.facts"), hint: undefined },
    { key: "buyableOnly", label: t("view.buyableOnly"), hint: t("view.buyableOnlyHint") },
    { key: "hideDone", label: t("view.hideDone"), hint: undefined },
    { key: "hidePostgame", label: t("view.hidePostgame"), hint: undefined },
  ] as const;
  const activeToggles = toggles.filter((x) => profile.view[x.key]).length;
  const canSearch = profile.dashboard.view !== "overview";

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">{t("nav.dashboard")}</h1>
      <div className="flex items-center gap-1 border-b">
        <div role="tablist" className="flex min-w-0 flex-1 gap-1">
          {views.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={profile.dashboard.view === v}
              onClick={() => setDashboardView(v)}
              className={`-mb-px border-b-2 px-2.5 py-2 text-sm whitespace-nowrap ${profile.dashboard.view === v ? "border-primary font-medium" : "text-muted-foreground border-transparent"}`}
            >
              {t(`dash.views.${v}` as const)}
            </button>
          ))}
        </div>
        {canSearch && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("dash.search")}
            aria-pressed={searchOpen || needle !== ""}
            onClick={() => setSearchOpen((o) => !o)}
          >
            <SearchIcon />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="mb-1" />}
            aria-label={t("dash.viewMenu")}
          >
            {t("dash.viewMenu")}
            {activeToggles > 0 && <span className="tabular-nums"> · {activeToggles}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {toggles.map((x) => (
              <DropdownMenuCheckboxItem
                key={x.key}
                checked={profile.view[x.key]}
                onCheckedChange={(v) => setView({ [x.key]: v })}
                title={x.hint}
              >
                {x.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
