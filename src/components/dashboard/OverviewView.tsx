import { useState } from "react";
import { withBase } from "@/lib/base";
import { useTranslations } from "@/i18n";
import { chapters } from "@/lib/data";
import { chapterProgressOfGuides } from "@/lib/guide/dashboard";
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
        <ul className="flex gap-1">
          {chapters.map((c) => {
            const p = progressOf(c.id);
            const isSelected = c.id === selected.id;
            return (
              <li key={c.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-label={`${label(c)}: ${t("step.progress", { done: p.done, total: p.total })}`}
                  aria-pressed={isSelected}
                  title={label(c)}
                  onClick={() => setPicked(c.id)}
                  className={`flex w-full flex-col items-center gap-0.5 rounded-md outline-offset-2 ${c.phase === "postgame" ? "opacity-60" : ""}`}
                >
                  <span
                    className={`bg-muted block h-7 w-full overflow-hidden rounded-md ${isSelected ? "ring-primary ring-2 ring-offset-1" : ""}`}
                  >
                    <span className="bg-primary block h-full" style={{ width: `${p.pct}%` }} />
                  </span>
                  <span
                    className={`text-xs tabular-nums ${c.id === currentId ? "text-primary font-medium" : "text-muted-foreground"}`}
                  >
                    {c.phase === "main" ? c.number : "PG"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{label(selected)}</div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {selected.id === currentId && <span>{t("dash.isCurrent")} · </span>}
              {sp.total > 0 ? t("step.progress", { done: sp.done, total: sp.total }) : "–"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChapter(selected.id)}
            className="text-primary shrink-0 text-sm hover:underline"
          >
            {t("dash.openChapter")} →
          </button>
        </div>
      </section>

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
    </div>
  );
}
