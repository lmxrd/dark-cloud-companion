import { useState } from "react";
import { cn } from "cn";
import { withBase } from "@/lib/base";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import { chapters } from "@/lib/data";
import {
  CATEGORY_ORDER,
  chapterCategoryProgress,
  chapterProgressOfGuides,
} from "@/lib/guide/dashboard";
import { guideProgress, isStepDone } from "@/lib/guide/progress";
import type { Guide } from "@/lib/guide/types";

/** A strip with one segment per chapter (tap to inspect) plus one progress row per switched-on guide. */
export function OverviewView({
  guides,
  checks,
  currentId,
  onChapter,
}: {
  guides: Guide[];
  checks: Record<string, true>;
  currentId: string;
  onChapter: (id: string) => void;
}) {
  const t = useTranslations();
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? currentId;
  const label = (c: (typeof chapters)[number]) =>
    c.phase === "main" ? `${c.number}. ${c.title}` : c.title;
  const progressOf = (id: string) => {
    const p = chapterProgressOfGuides(guides, id, checks);
    return { ...p, pct: p.total ? Math.round((p.done / p.total) * 100) : 0 };
  };
  const selected = chapters.find((c) => c.id === selectedId) ?? chapters[0];
  const sp = progressOf(selected.id);

  return (
    <div className="flex flex-col gap-4">
      {guides.length === 0 && <p className="text-muted-foreground text-sm">{t("dash.noActive")}</p>}

      <section aria-label={t("dash.overviewChapters")} className="flex flex-col gap-2">
        <ul className="grid grid-cols-9 gap-1.5">
          {chapters.map((c) => {
            const p = progressOf(c.id);
            const isSelected = c.id === selected.id;
            const isCurrent = c.id === currentId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-label={`${label(c)}: ${t("step.progress", { done: p.done, total: p.total })}`}
                  aria-pressed={isSelected}
                  title={label(c)}
                  onClick={() => setPicked(c.id)}
                  className={cn(
                    "bg-card relative grid aspect-square w-full place-items-center overflow-hidden rounded-md border-2 outline-offset-2 transition-[translate,box-shadow]",
                    isSelected ? "shadow-sticker-sm -translate-y-0.5" : "border-border/50",
                    isCurrent && "outline-secondary outline-3",
                  )}
                >
                  {/* Fills from the bottom as the chapter is completed. */}
                  <span
                    aria-hidden
                    className="bg-primary absolute inset-x-0 bottom-0 transition-[height]"
                    style={{ height: `${p.pct}%` }}
                  />
                  <span
                    className={cn(
                      "font-heading relative text-sm font-extrabold tabular-nums sm:text-base",
                      c.phase === "postgame" && "text-xs sm:text-sm",
                    )}
                  >
                    {c.phase === "main" ? c.number : t("chapter.postgameShort")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="bg-card flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{label(selected)}</div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {selected.id === currentId && <span>{t("dash.isCurrent")} · </span>}
              {sp.total > 0 ? t("step.progress", { done: sp.done, total: sp.total }) : "–"}
            </div>
          </div>
          <Button size="sm" className="shrink-0" onClick={() => onChapter(selected.id)}>
            {t("dash.openChapter")} →
          </Button>
        </div>
      </section>

      {guides.length > 0 && (
        <CollectableMatrix
          guides={guides}
          checks={checks}
          currentId={currentId}
          onChapter={onChapter}
        />
      )}

      <section aria-labelledby="overview-guides" className="flex flex-col gap-1">
        <h2 id="overview-guides" className="font-heading text-base font-extrabold tracking-tight">
          {t("dash.overviewGuides")}
        </h2>
        <ul className="flex flex-col divide-y">
          {guides.map((g) => {
            const p = guideProgress(g, checks);
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            const next = g.steps.find((s) => !isStepDone(g, s, checks));
            return (
              <li key={g.id} className="flex flex-col gap-1 py-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <a
                    className="truncate font-medium hover:underline"
                    href={withBase(`/guides/view?id=${encodeURIComponent(g.id)}`)}
                  >
                    {g.title}
                  </a>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {t("step.progress", { done: p.done, total: p.total })}
                  </span>
                </div>
                <div
                  className="bg-muted h-1.5 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label={g.title}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {next ? `${t("dash.nextSteps")}: ${next.title}` : t("dash.allDone")}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

type Cell = { done: number; total: number };

/** How far a cell is: an empty, half or full dot. */
function Dot({ cell }: { cell: Cell | undefined }) {
  if (!cell) return <span className="text-muted-foreground/50">–</span>;
  const state = cell.done === 0 ? "empty" : cell.done === cell.total ? "full" : "half";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 rounded-full border-2",
        state === "full" && "bg-primary border-border",
        state === "half" &&
          "border-border bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)]",
        state === "empty" && "border-border/40",
      )}
    />
  );
}

/** Chapters in rows, collectable categories in columns: what was skipped where. */
function CollectableMatrix({
  guides,
  checks,
  currentId,
  onChapter,
}: {
  guides: Guide[];
  checks: Record<string, true>;
  currentId: string;
  onChapter: (id: string) => void;
}) {
  const t = useTranslations();
  const rows = chapters.map((c) => ({
    chapter: c,
    cells: new Map(chapterCategoryProgress(guides, c.id, checks).map((x) => [x.category, x])),
  }));
  const columns = CATEGORY_ORDER.filter((cat) => rows.some((r) => r.cells.has(cat)));
  if (columns.length === 0) return null;

  return (
    <section aria-labelledby="overview-matrix" className="flex flex-col gap-2">
      <h2 id="overview-matrix" className="font-heading text-base font-extrabold tracking-tight">
        {t("dash.matrixTitle")}
      </h2>
      <div className="bg-card overflow-x-auto rounded-lg border-2">
        <table className="w-full text-center text-xs tabular-nums">
          <thead>
            <tr className="border-b-2">
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                <abbr title={t("dash.chapter")} className="no-underline">
                  {t("dash.chapterAbbr")}
                </abbr>
              </th>
              {columns.map((cat) => (
                <th key={cat} scope="col" className="px-1 py-1.5 font-semibold">
                  <abbr title={t(`dash.cat.${cat}` as const)} className="no-underline">
                    {t(`dash.catAbbr.${cat}` as const)}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ chapter: c, cells }) => (
              <tr
                key={c.id}
                className={cn("border-b last:border-b-0", c.id === currentId && "bg-secondary/15")}
              >
                <th scope="row" className="px-1 py-0.5 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() => onChapter(c.id)}
                    title={c.phase === "main" ? `${c.number}. ${c.title}` : c.title}
                    aria-label={`${t("dash.openChapter")}: ${c.phase === "main" ? `${c.number}. ${c.title}` : c.title}`}
                    className="min-h-8 w-full rounded px-1 text-left hover:underline"
                  >
                    {c.phase === "main" ? c.number : t("chapter.postgameShort")}
                  </button>
                </th>
                {columns.map((cat) => {
                  const cell = cells.get(cat);
                  return (
                    <td
                      key={cat}
                      className="px-1 py-0.5"
                      title={
                        cell
                          ? `${t(`dash.cat.${cat}` as const)}: ${cell.done} / ${cell.total}`
                          : undefined
                      }
                    >
                      <Dot cell={cell} />
                      {cell && (
                        <span className="sr-only">
                          {cell.done} / {cell.total}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
