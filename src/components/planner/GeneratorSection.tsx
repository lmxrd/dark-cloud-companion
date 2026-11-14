import { stageNeedsItems } from "@/lib/guide/buildItems";
import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/lib/useAppStore";
import { cn } from "cn";
import { withBase } from "@/lib/base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import { STAT_KEYS, type AbilityId, type Stats, type Weapon, type WeaponType } from "@/lib/schemas";
import { startToState } from "@/lib/guide/derive";
import { $draft } from "@/lib/guide/draft";
import { planResultToGuide, stateToBuildStart } from "@/lib/guide/fromPlan";
import { WORKER_FAILED, cancelPlanner, loadTemplates, runPlanner } from "@/lib/planner/client";
import { ancestorsOf, finalWeaponIds, rootWeaponIds } from "@/lib/planner/graph";
import {
  earliestChapter,
  STORY_DEFAULTS,
  type AbilitySource,
  type PlanProgress,
  type PlanResult,
} from "@/lib/planner/plan";
import type { Objective } from "@/lib/planner/solve";
import { getWeapon, weaponById, weaponData } from "@/lib/planner/sources";
import { placeResult } from "@/lib/planner/timeline";
import { freshState, type WeaponState } from "@/lib/weapons/mechanics";
import { $profile, addShoppingGoal, saveGuide, setPlannerInputs, setView } from "@/lib/store";
import type { PlannerInputs } from "@/lib/profiles";
import { queryParam, setQuery } from "@/lib/url";
import { AbilityPicker } from "./AbilityPicker";
import { AddToListButton } from "@/components/shopping/AddToListButton";
import { PlanPreview } from "./PlanPreview";
import { StartSpecs } from "./StartSpecs";
import { selectClass, WeaponSelect } from "./WeaponSelect";
import { TargetSpecs } from "./TargetSpecs";
import { WeaponTypeTabs } from "./WeaponTypeTabs";

function defaultStart(targetId: string): string {
  const anc = [...ancestorsOf(targetId)];
  return anc.find((id) => rootWeaponIds.has(id)) ?? targetId;
}

/**
 * The default target of a type: the alphabetically first final weapon (e.g. Grade Zero), or — for
 * types without one (clubs) — the alphabetically first weapon of the highest SP tier.
 */
function defaultTargetOf(type: WeaponType): string {
  const first = (ws: Weapon[]) => [...ws].sort((a, b) => a.name.localeCompare(b.name))[0]?.id;
  const finals = weaponData.weapons.filter((w) => w.type === type && finalWeaponIds.includes(w.id));
  if (finals.length) return first(finals)!;
  const ws = weaponData.weapons.filter((w) => w.type === type);
  const top = Math.max(...ws.map((w) => w.spPerLevel));
  return first(ws.filter((w) => w.spPerLevel === top))!;
}

const isZero = (s: Stats) => STAT_KEYS.every((k) => s[k] === 0);

/** Remembered inputs moved to another target, as if it had been picked in the form. */
/**
 * The chapter the planner starts at for a target: the earliest it can be built in, but not before
 * chapter 2, when Conda's Goods opens (the everyday items for most stats are sold there).
 */
const defaultChapter = (start: string, id: string) => Math.max(2, earliestChapter(start, id));

type SolveTime = "quick" | "thorough" | "best" | "excellent";
/**
 * Seconds the solver may spend on each route it solves exactly (twice that when following the
 * story). Measured over the built-in plans against 60 s: 10 s costs ~3% more ABS, 15 s ~2%, 30 s
 * under 1%; below 10 s solves often end without any plan. The built-in plans use 120 s.
 */
const SOLVE_SECONDS: Record<SolveTime, number> = {
  quick: 15,
  thorough: 30,
  best: 60,
  excellent: 120,
};

function retarget(inputs: PlannerInputs, id: string): PlannerInputs {
  const w = getWeapon(id);
  const keepStart = inputs.customStart && ancestorsOf(id).has(inputs.start.weaponId);
  return {
    ...inputs,
    targetId: id,
    endStats: { ...w.maxStats },
    endLevel: 0,
    customStart: keepStart,
    maxChapter: defaultChapter(defaultStart(id), id),
  };
}

/**
 * Generates an optimal weapon build: pick a weapon type (left tabs), a target weapon with required
 * specs, optional abilities, a start point and the limits; the result can be opened in the editor or
 * saved as a guide.
 */
export function GeneratorSection({ onOpenEditor }: { onOpenEditor: () => void }) {
  const t = useTranslations();
  const { view } = useProfile();
  // The same setting as the dashboard toggle: plans only use buyable items unless it is switched off.
  const allowFound = !view.buyableOnly;
  // The last inputs are remembered per profile; ignore ones that point at weapons that no longer exist.
  const remembered = $profile.get().planner;
  const valid =
    remembered && weaponById.has(remembered.targetId) && weaponById.has(remembered.start.weaponId)
      ? remembered
      : undefined;
  // Weapon pages link here with ?target=<weapon id>; it replaces the remembered target.
  const [linked] = useState(() => {
    const id = queryParam("target");
    return id && weaponById.has(id) ? id : undefined;
  });
  const saved0 = linked && valid && linked !== valid.targetId ? retarget(valid, linked) : valid;
  const initialTarget = linked ?? saved0?.targetId ?? defaultTargetOf("wrench");
  const [typeTab, setTypeTab] = useState<WeaponType>(() => getWeapon(initialTarget).type);
  const [targetId, setTargetId] = useState(initialTarget);
  // Target specs default to the weapon's max stats (all-zero inputs come from older remembered data).
  const [endStats, setEndStats] = useState<Stats>(() =>
    saved0 && !isZero(saved0.endStats) ? saved0.endStats : { ...getWeapon(initialTarget).maxStats },
  );
  const [endLevel, setEndLevel] = useState(saved0?.endLevel ?? 0);
  const [abilities, setAbilities] = useState<AbilityId[]>(saved0?.abilities ?? []);
  const [abilitySource, setAbilitySource] = useState<AbilitySource>(
    saved0?.abilitySource ?? "spheres",
  );
  const [itemPool, setItemPool] = useState<"cheap" | "crystals">(saved0?.itemPool ?? "cheap");
  const [solveTime, setSolveTime] = useState<SolveTime>(saved0?.solveTime ?? "quick");
  const [story, setStory] = useState(saved0?.story ?? false);
  const [customStart, setCustomStart] = useState(saved0?.customStart ?? false);
  const [start, setStart] = useState<WeaponState>(() =>
    saved0?.customStart
      ? startToState(saved0.start)
      : freshState(getWeapon(defaultStart(initialTarget))),
  );
  const [support, setSupport] = useState(saved0 ? saved0.start.spBonus === 1 : true);
  const [objective, setObjective] = useState<Objective>(saved0?.objective ?? "abs");
  const [maxChapter, setMaxChapter] = useState(
    () => saved0?.maxChapter ?? defaultChapter(defaultStart(initialTarget), initialTarget),
  );
  const [budget, setBudget] = useState(saved0?.budget ?? "");
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [used, setUsed] = useState<{
    start: WeaponState;
    spBonus: number;
    goalLabel: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Phones and tablets show one step at a time; wide screens show all three.
  const [step, setStep] = useState(0);

  // Remember the inputs whenever they change.
  useEffect(() => {
    const { acquire: _a, ...startPart } = stateToBuildStart(start, support ? 1 : 0);
    setPlannerInputs({
      targetId,
      objective,
      maxChapter,
      budget,
      abilities,
      abilitySource,
      itemPool,
      solveTime,
      story,
      customStart,
      endStats,
      endLevel,
      start: startPart,
    });
  }, [
    targetId,
    objective,
    maxChapter,
    budget,
    abilities,
    abilitySource,
    itemPool,
    solveTime,
    story,
    customStart,
    endStats,
    endLevel,
    start,
    support,
  ]);

  // Elapsed time while planning, so a long solve doesn't look stuck.
  useEffect(() => {
    if (!running) return;
    const began = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 500);
    return () => clearInterval(timer);
  }, [running]);

  // The target dropdown puts the final weapons of the line in their own tier at the top, then groups
  // the rest by SP tier (the game's low/mid/high weapon tiers), highest first, so endgame weapons
  // sit above starter weapons like the Battle Wrench.
  const typeWeapons = useMemo(() => {
    const ofType = weaponData.weapons.filter((x) => x.type === typeTab);
    const name = (a: Weapon, b: Weapon) => a.name.localeCompare(b.name);
    const finals = ofType.filter((w) => finalWeaponIds.includes(w.id)).sort(name);
    const byTier = new Map<number, Weapon[]>();
    for (const w of ofType.filter((x) => !finals.includes(x)))
      byTier.set(w.spPerLevel, [...(byTier.get(w.spPerLevel) ?? []), w]);
    return [
      ...(finals.length ? [{ sp: "final" as const, weapons: finals }] : []),
      ...[...byTier.entries()]
        .sort(([a], [b]) => b - a)
        .map(([sp, weapons]) => ({ sp, weapons: [...weapons].sort(name) })),
    ];
  }, [typeTab]);
  const startOptions = useMemo(() => ancestorsOf(targetId), [targetId]);
  const target = getWeapon(targetId);

  /** Selecting a target prefills its max specs and, unless a custom start is set, the line's first weapon. */
  const selectTarget = (id: string) => {
    setTargetId(id);
    setEndStats({ ...getWeapon(id).maxStats });
    setEndLevel(0);
    const from = defaultStart(id);
    if (!ancestorsOf(id).has(start.weaponId)) setStart(freshState(getWeapon(from)));
    setMaxChapter(defaultChapter(from, id));
    setResult(null);
  };

  const changeType = (type: WeaponType) => {
    setTypeTab(type);
    if (target.type === type) return;
    // Switching a tab defaults to the type's highest-tier weapon.
    selectTarget(defaultTargetOf(type));
  };

  const chooseStartPoint = (mode: "optimal" | "custom") => {
    setCustomStart(mode === "custom");
    setResult(null);
    if (mode === "optimal") setStart(freshState(getWeapon(defaultStart(targetId))));
  };

  // The linked target is now remembered with the other inputs: drop it from the URL so a reload
  // keeps whatever the user picks next.
  useEffect(() => {
    if (linked) setQuery({ target: null }, { replace: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm the sphere-template cache for the current option set while the user fills in the form,
  // so the first "generate plan" doesn't pay for it (it all runs in the planner worker).
  useEffect(() => {
    loadTemplates({ maxChapter, spBonus: support ? 1 : 0, allowFound, pool: itemPool }).catch(
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxChapter, support, allowFound, itemPool]);

  const goalLabel = STAT_KEYS.every((k) => endStats[k] >= target.maxStats[k])
    ? t("planner.goal.max")
    : isZero(endStats)
      ? t("planner.goal.reach")
      : t("planner.customGoal");

  const generate = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setProgress(null);
    try {
      const r = await runPlanner(
        {
          start,
          // "Optimal" searches every acquirable weapon in the target's build-up line for the
          // cheapest start; a custom start is used exactly as given.
          optimalStart: !customStart,
          targetId,
          objective,
          goal: { kind: "stats", stats: endStats, level: endLevel },
          maxChapter,
          spBonus: support ? 1 : 0,
          allowFound,
          maxGilda: budget.trim() ? Math.max(0, Number(budget)) : undefined,
          abilities,
          abilitySource,
          itemPool,
          // Following the story, the model is larger: give it twice the time.
          timeLimitSec: SOLVE_SECONDS[solveTime] * (story ? 2 : 1),
          ...(story ? { progression: STORY_DEFAULTS } : {}),
        },
        setProgress,
      );
      setResult(r);
      // The optimal search may start from a different weapon than the form's default.
      const startUsed =
        !customStart && r.plan?.stages[0]
          ? freshState(getWeapon(r.plan.stages[0].weaponId))
          : start;
      setUsed({ start: startUsed, spBonus: support ? 1 : 0, goalLabel });
    } catch (e) {
      if (String(e).includes("cancelled")) return;
      const message = String(e instanceof Error ? e.message : e);
      setError(message === WORKER_FAILED ? t("planner.workerFailed") : message);
    } finally {
      setRunning(false);
    }
  };

  /** The generated build as a guide. */
  const draft = useMemo(() => {
    if (result?.status !== "ok" || !used) return null;
    const title = `${target.name} — ${t(`planner.obj.${objective}` as const)}`;
    return planResultToGuide({
      title,
      description: `${t(`planner.obj.${objective}` as const)} · ${used.goalLabel} · ${t("planner.chapterOption", { n: maxChapter })}`,
      result,
      start: used.start,
      spBonus: used.spBonus,
      ...(result.acquire ? { acquire: result.acquire } : {}),
      // Following the story, steps go after the sections the planner placed them in.
      ...(result.stageChapters ? { placement: placeResult(result, "story") } : {}),
    });
    // The description should describe the request that produced the result, not later form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const summary = [
    target.name,
    goalLabel,
    customStart ? t("planner.startPoint.custom") : t("planner.startPoint.optimal"),
    t(`planner.objShort.${objective}` as const),
    t("planner.chapterOption", { n: maxChapter }),
  ].join(" · ");
  const steps = [t("planner.stepTarget"), t("planner.stepStart"), t("planner.stepOptions")];
  const panel = (i: number) =>
    cn(
      "bg-card flex min-w-0 flex-col gap-4 rounded-xl border-2 p-4",
      step !== i && "max-lg:hidden",
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t("planner.intro")}</p>

      {/* Not a locked wizard: every step can be opened directly. */}
      <nav aria-label={t("planner.steps")} className="lg:hidden">
        <ol className="grid grid-cols-3 gap-1.5">
          {steps.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                aria-current={step === i ? "step" : undefined}
                onClick={() => setStep(i)}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-md border-2 px-2 py-1.5 text-xs font-semibold",
                  step === i
                    ? "bg-accent text-accent-foreground shadow-sticker-sm"
                    : "text-muted-foreground border-border/40",
                )}
              >
                <span className="bg-background grid size-5 place-items-center rounded-full border-2 text-[10px]">
                  {i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section className={panel(0)} aria-label={t("planner.target")}>
          <h3 className="font-heading font-extrabold tracking-tight">{t("planner.target")}</h3>
          <WeaponTypeTabs value={typeTab} onChange={changeType} />
          <Label className="flex flex-col items-start gap-1">
            {t("planner.pickTarget")}
            <select
              className={selectClass}
              value={targetId}
              onChange={(e) => selectTarget(e.target.value)}
            >
              {typeWeapons.map((g) => (
                <optgroup
                  key={g.sp}
                  label={
                    g.sp === "final" ? t("planner.finalTier") : t("planner.spTier", { n: g.sp })
                  }
                >
                  {g.weapons.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="text-muted-foreground text-xs font-normal">
              {t("planner.spTier", { n: target.spPerLevel })}
            </span>
          </Label>
          <TargetSpecs
            weaponId={targetId}
            stats={endStats}
            level={endLevel}
            onStats={setEndStats}
            onLevel={setEndLevel}
          />
          <AbilityPicker abilities={abilities} onChange={setAbilities} />
          {abilities.length > 0 && (
            <Label className="flex w-full flex-col items-start gap-1">
              {t("planner.abilitySource")}
              <select
                className={selectClass}
                value={abilitySource}
                onChange={(e) => setAbilitySource(e.target.value as AbilitySource)}
              >
                <option value="spheres">{t("planner.abilitySource.spheres")}</option>
                <option value="cheapest">{t("planner.abilitySource.cheapest")}</option>
              </select>
            </Label>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={panel(1)} aria-label={t("planner.startSection")}>
            <h3 className="font-heading font-extrabold tracking-tight">
              {t("planner.startSection")}
            </h3>
            <Label className="flex w-full flex-col items-start gap-1">
              {t("planner.startPoint")}
              <select
                className={selectClass}
                value={customStart ? "custom" : "optimal"}
                onChange={(e) => chooseStartPoint(e.target.value as "optimal" | "custom")}
              >
                <option value="optimal">{t("planner.startPoint.optimal")}</option>
                <option value="custom">{t("planner.startPoint.custom")}</option>
              </select>
            </Label>
            {customStart ? (
              <div className="flex flex-col gap-3">
                <Label className="flex w-full flex-col items-start gap-1">
                  {t("planner.pickStart")}
                  <WeaponSelect
                    value={start.weaponId}
                    ids={startOptions}
                    tierOrder
                    onChange={(id) => setStart(freshState(getWeapon(id)))}
                  />
                </Label>
                <StartSpecs state={start} onChange={setStart} />
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">{t("planner.startPoint.optimalHint")}</p>
            )}
            <Label className="flex items-center gap-2 text-sm">
              <Switch checked={support} onCheckedChange={setSupport} />
              {t("planner.support")}
            </Label>
          </section>

          <section className={panel(2)} aria-label={t("planner.optionsSection")}>
            <h3 className="font-heading font-extrabold tracking-tight">
              {t("planner.optionsSection")}
            </h3>
            <Label className="flex flex-col items-start gap-1">
              {t("planner.objective")}
              <select
                className={selectClass}
                value={objective}
                onChange={(e) => setObjective(e.target.value as Objective)}
              >
                {(["abs", "gilda", "steps"] as const).map((o) => (
                  <option key={o} value={o}>
                    {t(`planner.obj.${o}` as const)}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t("planner.chapter")}
              <select
                className={selectClass}
                value={maxChapter}
                onChange={(e) => setMaxChapter(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {t("planner.chapterOption", { n })}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t("planner.budget")}
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={t("planner.budgetPlaceholder")}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </Label>
            <Label className="flex w-full flex-col items-start gap-1">
              {t("planner.itemPool")}
              <select
                className={selectClass}
                value={itemPool}
                onChange={(e) => setItemPool(e.target.value as "cheap" | "crystals")}
              >
                <option value="cheap">{t("planner.itemPool.cheap")}</option>
                <option value="crystals">{t("planner.itemPool.crystals")}</option>
              </select>
            </Label>
            <Label className="flex items-start gap-2 text-sm">
              <Switch checked={story} onCheckedChange={setStory} />
              <span className="flex flex-col gap-0.5">
                {t("planner.story")}
                <span className="text-muted-foreground text-xs font-normal">
                  {t("planner.storyHint")}
                </span>
              </span>
            </Label>
            <Label className="flex w-full flex-col items-start gap-1">
              {t("planner.solveTime")}
              <select
                className={selectClass}
                value={solveTime}
                onChange={(e) => setSolveTime(e.target.value as SolveTime)}
              >
                {(["quick", "thorough", "best", "excellent"] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`planner.solveTime.${v}` as const, {
                      n: SOLVE_SECONDS[v] * (story ? 2 : 1),
                    })}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Switch
                checked={view.buyableOnly}
                onCheckedChange={(v) => setView({ buyableOnly: v })}
              />
              {t("planner.found")}
            </Label>
          </section>
        </div>
      </div>

      {/* Generate stays one tap away: pinned above the phone tab bar, at the bottom on desktop. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-4">
        <div className="bg-card shadow-sticker flex flex-col gap-2 rounded-xl border-2 p-2 pl-3">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs" title={summary}>
              {summary}
            </p>
            {running && (
              <Button
                variant="outline"
                onClick={() => {
                  cancelPlanner();
                  setRunning(false);
                }}
              >
                {t("planner.cancel")}
              </Button>
            )}
            <Button onClick={generate} disabled={running} className="shrink-0">
              {running ? t("planner.running") : t("planner.generate")}
            </Button>
          </div>
          {running && (
            <div className="flex flex-col gap-1 pr-1" role="status" aria-live="polite">
              <p className="text-xs">
                {t(`planner.progress.${progress?.phase ?? "templates"}` as const, {
                  done: (progress?.done ?? 0) + 1,
                  total: progress?.total ?? 1,
                })}{" "}
                <span className="text-muted-foreground tabular-nums">
                  · {t("planner.elapsed", { s: elapsed })}
                </span>
              </p>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all"
                  style={{
                    width: `${progress ? Math.round(((["templates", "rank", "solve", "finish"].indexOf(progress.phase) + progress.done / Math.max(1, progress.total)) / 4) * 100) : 5}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm">{t("planner.error", { message: error })}</p>
      )}
      {result?.status === "no-path" && <p className="text-sm">{t("planner.noPath")}</p>}
      {result?.status === "infeasible" && <p className="text-sm">{t("planner.infeasible")}</p>}

      {draft && (
        <section aria-label={t("planner.result")} className="flex flex-col gap-4">
          <h3 className="font-heading text-xl font-extrabold tracking-tight">
            {t("planner.result")}
          </h3>
          {result?.abilitiesMissing && (
            <p className="text-sm">
              {t("planner.abilitiesMissing", {
                list: result.abilitiesMissing.map((a) => t(`ability.${a}` as const)).join(", "),
              })}
            </p>
          )}
          <PlanPreview guide={draft} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={saved}
              onClick={() => {
                saveGuide(draft, { activate: true });
                setSaved(true);
              }}
            >
              {t("planner.saveAsGuide")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                $draft.set({ guide: draft, persisted: false });
                onOpenEditor();
              }}
            >
              {t("planner.openInEditor")}
            </Button>
            {draft.steps.some((s) => stageNeedsItems(s.build)) && (
              <AddToListButton
                size="sm"
                label={t("shopping.saveAndAdd")}
                onAdd={() => {
                  // The list follows the guide by id, so the plan is saved first.
                  if (!saved) {
                    saveGuide(draft, { activate: true });
                    setSaved(true);
                  }
                  addShoppingGoal({
                    kind: "build",
                    guideId: draft.id,
                    stepIds: draft.steps.filter((s) => stageNeedsItems(s.build)).map((s) => s.id),
                  });
                }}
              />
            )}
            {saved && (
              <span className="text-sm" role="status">
                {t("planner.saved")}{" "}
                <a className="underline" href={withBase("/guides")}>
                  {t("nav.guides")}
                </a>
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
