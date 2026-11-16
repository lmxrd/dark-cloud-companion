import { useState } from "react";
import type { StepFilters } from "@/components/guide/StepCard";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";
import { ItemRow } from "@/components/guide/ItemRow";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import { chapterById, chapters } from "@/lib/data";
import {
  carriedSteps,
  anytimeSteps,
  chapterCategoryProgress,
  chapterProgressOfGuides,
  CATEGORY_ORDER,
  type ChapterCategory,
  openMissable,
  stepsInChapter,
} from "@/lib/guide/dashboard";
import { isStepDone } from "@/lib/guide/progress";
import { derivedFor } from "@/lib/guide/useDerived";
import type { Guide } from "@/lib/guide/types";
import { setCurrentChapter } from "@/lib/store";
import { setQuery, useQueryParam } from "@/lib/url";
import type { Profile } from "@/lib/profiles";
import { ChapterHero } from "./ChapterHero";
import { GuideBlock } from "./GuideBlock";

interface Props {
  guides: Guide[];
  profile: Profile;
  checks: Record<string, true>;
  chapterId: string;
  currentId: string;
  onChapter: (id: string) => void;
  filters: StepFilters;
}

/** The dashboard's chapter view: this chapter's steps from every switched-on guide. */
export function ChapterView({
  guides,
  profile,
  checks,
  chapterId,
  currentId,
  onChapter,
  filters,
}: Props) {
  const t = useTranslations();
  const chapter = chapterById.get(chapterId)!;
  const index = chapters.findIndex((c) => c.id === chapterId);
  const next = chapters[index + 1];
  const mainProgress = chapterProgressOfGuides(guides, chapterId, checks);
  const categories = chapterCategoryProgress(guides, chapterId, checks);
  const [showAnytime, setShowAnytime] = useState(false);
  const [missableOpen, setMissableOpen] = useState(false);
  // The category chip is `?cat=`; moving to another chapter drops it.
  const cat = useQueryParam("cat");
  const category = (CATEGORY_ORDER as string[]).includes(cat) ? (cat as ChapterCategory) : null;
  const listFilters: StepFilters = category ? { ...filters, category } : filters;

  // Missable items from the switched-on guides that are still open up to and including this chapter.
  const missable = openMissable(guides, checks, chapter.number);

  const blocks = guides
    .map((guide) => {
      const here = stepsInChapter(guide, chapterId).map((p) => ({
        ...p,
        from: undefined as number | undefined,
      }));
      // The main walkthrough lists everything per chapter already; other guides also show unfinished
      // earlier steps, except under a category chip, whose count covers this chapter only.
      const carried =
        guide.id === "main" || category
          ? []
          : carriedSteps(guide, chapterId, (s) => isStepDone(guide, s, checks));
      return { guide, placed: [...carried, ...here] };
    })
    .filter((b) => b.placed.length > 0);
  const anytime = guides
    .map((guide) => ({ guide, placed: anytimeSteps(guide) }))
    .filter((b) => b.placed.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <ChapterHero
        chapter={chapter}
        isCurrent={chapterId === currentId}
        pinned={profile.dashboard.currentChapter !== null}
        progress={mainProgress}
        categories={categories}
        category={category}
        onCategory={(c) => setQuery({ cat: c }, { replace: true })}
        onChapter={onChapter}
      />
      {mainProgress.total > 0 && mainProgress.done === mainProgress.total && next && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border-2 px-3 py-2 text-sm">
          <span>{t("dash.chapterDone")}</span>
          <Button
            size="sm"
            onClick={() => {
              onChapter(next.id);
              if (chapterId === currentId) setCurrentChapter(next.id);
            }}
          >
            {t("dash.goNext", { title: next.title })}
          </Button>
        </div>
      )}

      {guides.length === 0 && <p className="text-muted-foreground text-sm">{t("dash.noActive")}</p>}

      {missable.length > 0 && (
        <Collapsible
          open={missableOpen}
          onOpenChange={setMissableOpen}
          className="border-destructive bg-destructive/5 rounded-lg border-2"
        >
          <CollapsibleTrigger className="text-destructive flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold">
            <span className="flex items-center gap-2">
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
              {t("dash.missableCount", { n: missable.length })}
            </span>
            <span className="flex items-center gap-1 text-xs">
              {missableOpen ? t("dash.hide") : t("dash.show")}
              <ChevronDownIcon className={`size-4 ${missableOpen ? "rotate-180" : ""}`} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-1 pb-1">
            {missable.map((i) => (
              <ItemRow key={i.id} item={i} checks={checks} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {guides.length > 0 && blocks.length === 0 && anytime.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("dash.nothingHere")}</p>
      )}

      {blocks.map(({ guide, placed }) => (
        <GuideBlock
          key={guide.id}
          guide={guide}
          placed={placed}
          derived={derivedFor(guide)}
          filters={listFilters}
          chapterNumber={chapter.number}
        />
      ))}

      {anytime.length > 0 && (
        <Collapsible open={showAnytime} onOpenChange={setShowAnytime}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-3 text-left font-medium">
            <span>{t("dash.anytime")}</span>
            <span className="text-muted-foreground text-sm">
              {anytime.reduce((n, b) => n + b.placed.length, 0)}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-3">
            {anytime.map(({ guide, placed }) => (
              <GuideBlock
                key={guide.id}
                guide={guide}
                placed={placed}
                derived={derivedFor(guide)}
                filters={filters}
                chapterNumber={undefined}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function FilterBar({ onNeedle, needle }: { needle: string; onNeedle: (s: string) => void }) {
  const t = useTranslations();
  return (
    <Input
      type="search"
      placeholder={t("chapter.search")}
      aria-label={t("chapter.search")}
      value={needle}
      onChange={(e) => onNeedle(e.target.value)}
    />
  );
}
