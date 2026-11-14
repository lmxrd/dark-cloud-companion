import { useRef } from "react";
import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "@/i18n";
import { chapters } from "@/lib/data";
import type { ChapterCategory } from "@/lib/guide/dashboard";
import type { Chapter } from "@/lib/data";
import { setCurrentChapter } from "@/lib/store";

type Count = { done: number; total: number };

interface Props {
  chapter: Chapter;
  isCurrent: boolean;
  /** The user pinned a chapter instead of following progress. */
  pinned: boolean;
  progress: Count;
  categories: ({ category: ChapterCategory } & Count)[];
  category: ChapterCategory | null;
  onCategory: (c: ChapterCategory | null) => void;
  onChapter: (id: string) => void;
}

/**
 * The chapter view's summary card: chapter name, a thick progress bar and one chip per category
 * (tap to filter the list). Arrows or a horizontal swipe change chapter.
 */
export function ChapterHero({
  chapter,
  isCurrent,
  pinned,
  progress,
  categories,
  category,
  onCategory,
  onChapter,
}: Props) {
  const t = useTranslations();
  const index = chapters.findIndex((c) => c.id === chapter.id);
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  // Horizontal swipes change chapter; ignore mostly vertical ones and the scrolling chip row.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const inChips = (e.target as HTMLElement).closest("[data-no-swipe]");
    touch.current = inChips ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
    const target = dx < 0 ? next : prev;
    if (target) onChapter(target.id);
  };

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap tabular-nums",
      active
        ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
        : "border-border/40 text-muted-foreground hover:border-border",
    );

  return (
    <section
      className="bg-card shadow-sticker flex flex-col gap-3 rounded-xl border-2 p-4"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-bold tracking-wider uppercase">
          {chapter.phase === "main"
            ? t("dash.chapterNumber", { n: chapter.number })
            : t("postgame.badge")}
          {isCurrent && <span className="text-primary"> · {t("dash.current")}</span>}
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("dash.prev")}
          disabled={!prev}
          onClick={() => prev && onChapter(prev.id)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("dash.next")}
          disabled={!next}
          onClick={() => next && onChapter(next.id)}
        >
          <ChevronRightIcon />
        </Button>
        {pinned && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon-sm" />}
              aria-label={t("dash.moreActions")}
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setCurrentChapter(null)}>
                {t("dash.followProgress")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <h2 className="sr-only">
        {chapter.phase === "main" ? `${chapter.number}. ` : ""}
        {chapter.title}
      </h2>
      {/* The title doubles as the chapter picker. */}
      <select
        className="font-heading -mx-1 w-[calc(100%+0.5rem)] truncate rounded-md bg-transparent px-1 text-2xl font-extrabold tracking-tight md:text-3xl"
        value={chapter.id}
        onChange={(e) => onChapter(e.target.value)}
        aria-label={t("dash.chapter")}
      >
        {chapters.map((c) => (
          <option key={c.id} value={c.id} className="text-base font-normal">
            {c.phase === "main" ? `${c.number}. ` : ""}
            {c.title}
          </option>
        ))}
      </select>

      {progress.total > 0 && (
        <div className="flex items-center gap-3">
          <div
            className="bg-muted h-3 flex-1 overflow-hidden rounded-full border-2"
            role="progressbar"
            aria-label={chapter.title}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {t("step.progress", { done: progress.done, total: progress.total })}
          </span>
          <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">{pct}%</span>
        </div>
      )}

      {categories.length > 1 && (
        <div
          role="group"
          aria-label={t("dash.categoryFilter")}
          data-no-swipe
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-0.5 pb-1.5 [scrollbar-width:none]"
        >
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => onCategory(null)}
            className={chip(category === null)}
          >
            {t("dash.allCategories")}
          </button>
          {categories.map((c) => (
            <button
              key={c.category}
              type="button"
              aria-pressed={category === c.category}
              onClick={() => onCategory(category === c.category ? null : c.category)}
              className={chip(category === c.category)}
            >
              {t(`dash.cat.${c.category}` as const)} {c.done}/{c.total}
            </button>
          ))}
        </div>
      )}

      {!isCurrent && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setCurrentChapter(chapter.id)}
        >
          {t("dash.setCurrent")}
        </Button>
      )}
    </section>
  );
}
