import { useEffect, useMemo, useState } from "react";
import { useChecks, useProfile, useReady } from "@/lib/useAppStore";
import { CheckIcon } from "lucide-react";
import { CheckRow } from "@/components/chapter/CheckRow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "@/i18n";
import { chapterById, sectionById } from "@/lib/data";
import type { DerivedStep } from "@/lib/guide/derive";
import type { ChapterCategory } from "@/lib/guide/dashboard";
import { stepProgress } from "@/lib/guide/progress";
import { resolveEntry } from "@/lib/guide/refs";
import type { Section } from "@/lib/data";
import { stepTickId, textTickId, type Entry, type Guide, type Step } from "@/lib/guide/types";
import { setChecked } from "@/lib/store";
import { BuildStepBody } from "./BuildStepBody";
import { ItemRow } from "./ItemRow";
import { SectionFacts } from "./SectionFacts";

export interface StepFilters {
  hideDone: boolean;
  hidePostgame: boolean;
  showFacts: boolean;
  /** Warn about build steps that use items which can't be bought. */
  buyableOnly: boolean;
  /** Lowercased search text; entries that don't match are hidden. */
  needle: string;
  /** Show only collectables of this category, or only section medals ("medal"). */
  category?: ChapterCategory;
}

/** Entries that survive the view filters (hide done / post-game / search). */
export function visibleEntries(
  guide: Guide,
  step: Step,
  checks: Record<string, true>,
  f: StepFilters,
): Entry[] {
  return step.entries.filter((e) => {
    if (f.category && e.kind === "text") return false;
    if (e.kind === "text") {
      if (f.hideDone && checks[textTickId(guide.id, step.id, e.id)]) return false;
      return !f.needle || e.text.toLowerCase().includes(f.needle);
    }
    const r = resolveEntry(e);
    if (r.kind === "missing") return false;
    if (r.kind === "item") {
      if (f.category && r.item.category !== f.category) return false;
      if (f.hidePostgame && r.item.postgame) return false;
      if (f.hideDone && checks[r.item.id]) return false;
      return !f.needle || r.item.name.toLowerCase().includes(f.needle);
    }
    if (f.category && f.category !== "medal") return false;
    // Section facts: hidden while searching; hide when every medal is done and "hide done" is on.
    if (f.needle) return false;
    return !(f.hideDone && r.medals.length > 0 && r.medals.every((m) => checks[m.id]));
  });
}

interface Props {
  guide: Guide;
  step: Step;
  index: number;
  derived?: DerivedStep;
  filters: StepFilters;
  /** Chapter number the step was carried over from, when shown in a later chapter. */
  carriedFrom?: number;
  showWhere?: boolean;
  /** Fold finished steps to one line (tap to open). */
  collapseDone?: boolean;
}

export function StepCard({
  guide,
  step,
  index,
  derived,
  filters,
  carriedFrom,
  showWhere = true,
  collapseDone = false,
}: Props) {
  const t = useTranslations();
  const checks = useChecks();
  useProfile(); // re-render with the profile (guide edits)
  const entries = useMemo(
    () => visibleEntries(guide, step, checks, filters),
    [guide, step, checks, filters],
  );
  const progress = stepProgress(guide, step, checks);
  const complete = progress.total > 0 && progress.done === progress.total;
  // Finished steps start folded; ticking the last item of an open step doesn't fold it under you.
  // Cards mounted after hydration fold at once; while hydrating the ticks aren't loaded yet, so fold
  // as soon as they are. Only that first state decides; later changes are the user's.
  const ready = useReady();
  const [folded, setFolded] = useState(() => ready && collapseDone && complete);
  useEffect(() => {
    if (ready && collapseDone && complete) setFolded(true);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  if (step.entries.length > 0 && entries.length === 0 && !step.build && !step.notes) return null;
  // A category filter shows matching entries only, never steps without any.
  if (filters.category && entries.length === 0) return null;

  const ownTick =
    step.build || step.entries.length === 0 ? stepTickId(guide.id, step.id) : undefined;
  const chapter = step.chapterId ? chapterById.get(step.chapterId) : undefined;
  const section = step.sectionId ? sectionById.get(step.sectionId) : undefined;
  const showCounter = step.entries.length > 0 && progress.total > 0;
  // The step header carries the section kind; entries of other sections keep their own badge.
  const headerSection =
    section ??
    entries.reduce<Section | undefined>((found, e) => {
      if (found || e.kind !== "section") return found;
      const r = resolveEntry(e);
      return r.kind === "section" ? r.section : undefined;
    }, undefined);
  const isFolded = collapseDone && complete && folded;
  const title = <span>{step.title || `${index + 1}`}</span>;

  return (
    <Card size="sm" className="gap-0 py-0 shadow-none">
      <div
        className={`flex flex-wrap items-center gap-2 px-3 py-2 ${isFolded ? "" : "border-b"} ${complete ? "text-muted-foreground" : ""}`}
      >
        {ownTick && (
          <Checkbox
            checked={!!checks[ownTick]}
            onCheckedChange={(v) => setChecked(ownTick, v === true)}
            aria-label={step.title || t("step.markDone")}
          />
        )}
        {collapseDone && complete ? (
          <button
            type="button"
            aria-expanded={!isFolded}
            aria-label={t(isFolded ? "step.expandNamed" : "step.collapseNamed", {
              title: step.title || `${index + 1}`,
            })}
            onClick={() => setFolded(!isFolded)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium"
          >
            <CheckIcon className="size-4 shrink-0" aria-hidden />
            {title}
          </button>
        ) : (
          <span className="text-sm font-medium">{title}</span>
        )}
        {showWhere && chapter && (
          <Badge
            variant="outline"
            title={`${chapter.phase === "main" ? `${chapter.number}. ` : ""}${chapter.title}`}
          >
            {chapter.phase === "main" ? chapter.number : chapter.title}
            {section && section.title !== step.title ? ` › ${section.title}` : ""}
          </Badge>
        )}
        {carriedFrom !== undefined && (
          <Badge variant="secondary">{t("step.carried", { n: carriedFrom })}</Badge>
        )}
        {headerSection && (
          <Badge variant="outline" className="ml-auto">
            {t(`section.kind.${headerSection.kind}` as const)}
          </Badge>
        )}
        {showCounter && (
          <span
            className={`text-muted-foreground text-xs font-normal tabular-nums ${headerSection ? "" : "ml-auto"}`}
          >
            {t("step.progress", { done: progress.done, total: progress.total })}
          </span>
        )}
      </div>
      {!isFolded && (
        <CardContent className="flex flex-col gap-1 px-1 py-1">
          {(step.notes || step.build) && (
            <div className="flex flex-col gap-2 px-2 py-1">
              {step.notes && <p className="text-sm whitespace-pre-wrap">{step.notes}</p>}
              <BuildStepBody step={step} derived={derived} buyableOnly={filters.buyableOnly} />
            </div>
          )}
          {entries.map((e, i) => {
            if (e.kind === "text") {
              const id = textTickId(guide.id, step.id, e.id);
              return (
                <CheckRow
                  key={`t${e.id}`}
                  dense
                  checked={!!checks[id]}
                  onChange={(v) => setChecked(id, v)}
                  label={e.text}
                />
              );
            }
            const r = resolveEntry(e);
            if (r.kind === "item")
              return <ItemRow key={`i${e.ref}`} item={r.item} checks={checks} />;
            if (r.kind === "section")
              return (
                <SectionFacts
                  key={`s${e.ref}-${i}`}
                  section={r.section}
                  medals={r.medals}
                  checks={checks}
                  showFacts={filters.showFacts}
                  showKind={r.section.id !== headerSection?.id}
                />
              );
            return null;
          })}
        </CardContent>
      )}
    </Card>
  );
}
