import { stageNeedsItems } from "@/lib/guide/buildItems";
import { PageHeader } from "@/components/PageHeader";
import { useChecks, useProfile } from "@/lib/useAppStore";
import { cn } from "cn";
import { withBase } from "@/lib/base";
import { useMemo, useState } from "react";
import { queryParam, useQueryText } from "@/lib/url";
import { MoreHorizontalIcon, PlayIcon, StarIcon } from "lucide-react";
import { downloadGuides, fileSafe } from "@/components/ContentTransfer";
import { StepCard, type StepFilters } from "@/components/guide/StepCard";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import { chapterById } from "@/lib/data";
import { findGuide } from "@/lib/guide/builtin";
import { duplicateGuide, groupByChapter } from "@/lib/guide/ops";
import { isStepDone, stepsProgress } from "@/lib/guide/progress";
import { derivedFor } from "@/lib/guide/useDerived";
import { stepTickId, type Guide } from "@/lib/guide/types";
import { getWeapon } from "@/lib/planner/sources";
import { deleteGuide, saveGuide, toggleGuide } from "@/lib/store";
import { AddToListButton } from "@/components/shopping/AddToListButton";

const pctOf = (p: { done: number; total: number }) =>
  p.total ? Math.round((p.done / p.total) * 100) : 0;
const stepAnchor = (id: string) => `step-${id}`;

/** The guide's actions: duplicate for everyone, edit / export / delete for own guides. */
function GuideMenu({ guide }: { guide: Guide }) {
  const t = useTranslations();
  const mine = guide.kind === "custom";
  const q = encodeURIComponent(guide.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon-sm" />}
        aria-label={t("dash.moreActions")}
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {mine && (
          <DropdownMenuItem render={<a href={withBase(`/tools/planner/editor?edit=${q}`)} />}>
            {t("guides.edit")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            const copy = duplicateGuide(guide);
            saveGuide(copy);
            location.href = withBase(`/tools/planner/editor?edit=${encodeURIComponent(copy.id)}`);
          }}
        >
          {t("guides.duplicate")}
        </DropdownMenuItem>
        {mine && (
          <DropdownMenuItem
            onClick={() => downloadGuides(`dcc-guide-${fileSafe(guide.title)}.json`, [guide])}
          >
            {t("transfer.export")}
          </DropdownMenuItem>
        )}
        {mine && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (!confirm(t("guides.deleteConfirm"))) return;
                deleteGuide(guide.id);
                location.href = withBase("/guides");
              }}
            >
              {t("guides.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One guide, all its steps: a build-up timeline for weapon builds, chapter groups otherwise. Client-only (`?id=`). */
export function GuideViewPage() {
  const t = useTranslations();
  const profile = useProfile();
  const checks = useChecks();
  // Client-only island: the URL is there from the first render.
  const [id] = useState(() => queryParam("id") ?? "");
  const [needle, setNeedle] = useQueryText("q");
  // Chapter groups the user opened or closed; the rest follow the default.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const guide = id ? findGuide(id, profile.guides) : undefined;
  const groups = useMemo(() => (guide ? [...groupByChapter(guide.steps)] : []), [guide]);
  if (!guide) return <p className="text-sm">{t("guides.notFound")}</p>;

  const derived = derivedFor(guide);
  const p = stepsProgress(guide, guide.steps, checks);
  const pct = pctOf(p);
  const active = profile.activeGuides.includes(guide.id);
  const filters: StepFilters = {
    hideDone: profile.view.hideDone,
    hidePostgame: profile.view.hidePostgame,
    showFacts: profile.view.showFacts,
    buyableOnly: profile.view.buyableOnly,
    needle: needle.trim().toLowerCase(),
  };
  // A weapon build reads as a timeline of work and build-up steps.
  const isBuild = guide.steps.length > 0 && guide.steps.every((s) => s.build || s.buildUp);
  const nextIndex = guide.steps.findIndex((s) => !isStepDone(guide, s, checks));
  const next = nextIndex >= 0 ? guide.steps[nextIndex] : undefined;
  const groupKey = (chapterId: string | undefined) => chapterId ?? "anytime";

  const resume = () => {
    if (!next) return;
    setOpened((o) => ({ ...o, [groupKey(next.chapterId)]: true }));
    // Wait for the chapter group to open before scrolling.
    requestAnimationFrame(() =>
      document
        .getElementById(stepAnchor(next.id))
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const nextChapter = next?.chapterId ? chapterById.get(next.chapterId) : undefined;
  const resumeLabel = !next
    ? undefined
    : isBuild
      ? t("guides.resumeStage", { n: nextIndex + 1, title: next.title })
      : nextChapter
        ? t("guides.resumeChapter", {
            chapter:
              nextChapter.phase === "main"
                ? t("guides.chapterShort", { n: nextChapter.number })
                : nextChapter.title,
            title: next.title || nextChapter.title,
          })
        : t("guides.resumeStep", { title: next.title });
  // Build steps with items that aren't ticked yet: "add remaining steps" to the shopping list.
  const remaining = guide.steps
    .filter((s) => stageNeedsItems(s.build))
    .filter((s) => !checks[stepTickId(guide.id, s.id)])
    .map((s) => s.id);
  const target = guide.steps.at(-1)?.build?.weaponId;
  const finalWeapon = isBuild
    ? (derived.steps.get(guide.steps.at(-1)!.id)?.nextWeaponId ?? target)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        title={guide.title}
        description={guide.description}
        actions={<GuideMenu guide={guide} />}
      />

      {/* Stays in view while scrolling through long guides. */}
      <div className="bg-background/95 sticky top-0 z-20 -mx-4 border-b-2 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className="bg-muted h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border-2"
            role="progressbar"
            aria-label={guide.title}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {isBuild
              ? t("guides.stages", { done: p.done, total: p.total })
              : t("step.progress", { done: p.done, total: p.total })}
          </span>
          <label className="flex items-center gap-2 text-xs font-medium">
            <span className="hidden sm:inline">{t("guides.active")}</span>
            <Switch
              checked={active}
              onCheckedChange={(v) => toggleGuide(guide.id, v)}
              aria-label={t("guides.active")}
            />
          </label>
        </div>
      </div>

      {(guide.build || remaining.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {guide.build && (
            <p className="text-muted-foreground text-sm">
              {t("planner.totalAbs", { n: Math.round(derived.total.abs).toLocaleString() })} ·{" "}
              {t("planner.totalGilda", { n: Math.round(derived.total.gilda).toLocaleString() })}
            </p>
          )}
          {remaining.length > 0 && (
            <AddToListButton
              size="sm"
              label={t("shopping.addRemaining")}
              goal={{ kind: "build", guideId: guide.id, stepIds: remaining }}
            />
          )}
        </div>
      )}

      {resumeLabel && (
        <Button className="w-fit max-w-full" onClick={resume}>
          <PlayIcon />
          <span className="truncate">{resumeLabel}</span>
        </Button>
      )}

      {derived.errors.length > 0 && (
        <ul className="text-destructive list-disc pl-5 text-sm">
          {derived.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {isBuild ? (
        <ol className="relative flex flex-col gap-3 pl-7">
          {/* The timeline's spine. */}
          <span aria-hidden className="bg-border absolute top-2 bottom-2 left-[9px] w-0.5" />
          {guide.steps.map((step, index) => {
            const done = isStepDone(guide, step, checks);
            return (
              <li key={step.id} id={stepAnchor(step.id)} className="relative scroll-mt-20">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 -left-7 size-5 rounded-full border-2",
                    done ? "bg-primary border-border" : "bg-background border-border",
                    index === nextIndex && "ring-secondary ring-3",
                  )}
                />
                <StepCard
                  guide={guide}
                  step={step}
                  index={index}
                  derived={derived.steps.get(step.id)}
                  filters={filters}
                  showWhere={false}
                  collapseDone
                />
              </li>
            );
          })}
          {finalWeapon && (
            <li className="relative">
              <span
                aria-hidden
                className="bg-accent absolute top-0.5 -left-7 grid size-5 place-items-center rounded-full border-2"
              >
                <StarIcon className="size-3" />
              </span>
              <span className="font-heading font-extrabold">{getWeapon(finalWeapon).name}</span>
            </li>
          )}
        </ol>
      ) : (
        <>
          <Input
            type="search"
            className="max-w-xs"
            placeholder={t("chapter.search")}
            aria-label={t("chapter.search")}
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
          />
          {groups.map(([chapterId, placed]) => {
            const chapter = chapterId ? chapterById.get(chapterId) : undefined;
            const gp = stepsProgress(
              guide,
              placed.map((x) => x.step),
              checks,
            );
            const finished = gp.total > 0 && gp.done === gp.total;
            const title = chapter
              ? `${chapter.phase === "main" ? `${chapter.number}. ` : ""}${chapter.title}`
              : t("dash.anytime");
            const key = groupKey(chapterId);
            return (
              <Collapsible
                key={key}
                open={opened[key] ?? (groups.length <= 2 || !!needle)}
                onOpenChange={(v) => setOpened((o) => ({ ...o, [key]: v }))}
              >
                <CollapsibleTrigger
                  className={cn(
                    "bg-card flex w-full flex-col gap-1.5 rounded-md border-2 px-3 py-2.5 text-left",
                    finished && "opacity-60",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-semibold">{title}</span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {t("step.progress", { done: gp.done, total: gp.total })}
                    </span>
                  </span>
                  <span aria-hidden className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <span className="bg-primary block h-full" style={{ width: `${pctOf(gp)}%` }} />
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-2 pt-2">
                  {placed.map(({ step, index }) => (
                    <div key={step.id} id={stepAnchor(step.id)} className="scroll-mt-20">
                      <StepCard
                        guide={guide}
                        step={step}
                        index={index}
                        derived={derived.steps.get(step.id)}
                        filters={filters}
                        showWhere={false}
                      />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </>
      )}
    </div>
  );
}
