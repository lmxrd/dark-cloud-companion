import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { withBase } from "@/lib/base";
import { StepCard, type StepFilters } from "@/components/guide/StepCard";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useTranslations } from "@/i18n";
import { chapters } from "@/lib/data";
import { guideProgress, isStepDone } from "@/lib/guide/progress";
import type { Guide } from "@/lib/guide/types";
import { derivedFor } from "@/lib/guide/useDerived";

const PAGE = 5;

/** One collapsible section per switched-on guide with its next open steps; chapters are a chip filter. */
export function ByGuideView({
  guides,
  checks,
  filters,
}: {
  guides: Guide[];
  checks: Record<string, true>;
  filters: StepFilters;
}) {
  const t = useTranslations();
  const [chapterId, setChapterId] = useState("");
  const [shown, setShown] = useState<Record<string, number>>({});
  // Only the first guide starts open; anything the user toggled keeps its state.
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  if (guides.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        {t("dash.noActive")}{" "}
        <a className="underline" href={withBase("/guides")}>
          {t("nav.guides")}
        </a>
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label={t("dash.chapterFilter")}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {[{ id: "", label: t("dash.allChapters"), title: t("dash.allChapters") }]
          .concat(
            chapters.map((c) => ({
              id: c.id,
              label: c.phase === "main" ? String(c.number) : "PG",
              title: c.phase === "main" ? `${c.number}. ${c.title}` : c.title,
            })),
          )
          .map((c) => (
            <button
              key={c.id || "all"}
              type="button"
              aria-pressed={chapterId === c.id}
              aria-label={c.title}
              title={c.title}
              onClick={() => setChapterId(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${chapterId === c.id ? "border-primary bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}
            >
              {c.label}
            </button>
          ))}
      </div>
      {guides.map((g, gi) => {
        const p = guideProgress(g, checks);
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        const pool = g.steps
          .map((step, index) => ({ step, index }))
          .filter((x) => !chapterId || x.step.chapterId === chapterId)
          .filter((x) => !isStepDone(g, x.step, checks));
        const limit = shown[g.id] ?? PAGE;
        const derived = derivedFor(g);
        const open = opened[g.id] ?? gi === 0;
        return (
          <Collapsible
            key={g.id}
            open={open}
            onOpenChange={(v) => setOpened({ ...opened, [g.id]: v })}
            className={`flex flex-col gap-2 ${gi > 0 ? "border-t pt-3" : ""}`}
          >
            <div className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={open ? t("dash.hideGuide") : t("dash.showGuide")}
                  onClick={() => setOpened({ ...opened, [g.id]: !open })}
                  className="text-muted-foreground -m-1 p-1"
                >
                  <ChevronDownIcon className={`size-4 ${open ? "" : "-rotate-90"}`} />
                </button>
                <a
                  className="min-w-0 flex-1 truncate hover:underline"
                  href={withBase(`/guides/view?id=${encodeURIComponent(g.id)}`)}
                >
                  {g.title}
                </a>
                <span className="text-muted-foreground text-xs font-normal tabular-nums">
                  {t("step.progress", { done: p.done, total: p.total })}
                </span>
              </h2>
              <div
                className="bg-muted h-1 overflow-hidden rounded-full"
                role="progressbar"
                aria-label={g.title}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
              </div>
              {!open && (
                <p className="text-muted-foreground truncate text-xs">
                  {pool[0] ? `${t("dash.nextSteps")}: ${pool[0].step.title}` : t("dash.allDone")}
                </p>
              )}
            </div>
            <CollapsibleContent className="flex flex-col gap-2">
              {pool.length === 0 && (
                <p className="text-muted-foreground text-sm">{t("dash.allDone")}</p>
              )}
              {pool.slice(0, limit).map(({ step, index }) => (
                <StepCard
                  key={step.id}
                  guide={g}
                  step={step}
                  index={index}
                  derived={derived.steps.get(step.id)}
                  filters={filters}
                />
              ))}
              {pool.length > limit && (
                <Button
                  variant="link"
                  size="sm"
                  className="w-fit px-0"
                  onClick={() => setShown({ ...shown, [g.id]: limit + PAGE })}
                >
                  {t("dash.moreSteps", { n: Math.min(PAGE, pool.length - limit) })}
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
