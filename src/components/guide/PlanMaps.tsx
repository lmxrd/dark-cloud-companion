// The two map views of a weapon plan (a build guide or the planner's result): "Map" is the chain of
// work steps with each step's stats at its start and end; "Detailed map" lists everything synthed in
// each step, every sphere with what goes into it and what it passes on.
import { cn } from "cn";
import { useTranslations } from "@/i18n";
import type { DerivedBuild } from "@/lib/guide/derive";
import type { Guide, Step } from "@/lib/guide/types";
import type { ItemUse, Recipe } from "@/lib/planner/types";
import type { AbilityId } from "@/lib/schemas";
import { getWeapon } from "@/lib/planner/sources";
import { finalWeaponIds } from "@/lib/planner/graph";
import { addShoppingGoal } from "@/lib/store";
import { AddToListButton } from "@/components/shopping/AddToListButton";
import { CARD_STATS, StatPairs, type CardStat } from "@/components/weapons/BuildUpMap";
import { acquireText } from "./BuildStepBody";

export const PLAN_VIEWS = ["steps", "map", "detailed"] as const;
export type PlanView = (typeof PLAN_VIEWS)[number];

type Stat = Partial<Record<CardStat, number>>;
const workSteps = (guide: Guide) =>
  guide.steps.filter((s): s is Step & { build: NonNullable<Step["build"]> } => !!s.build);

/** A step's header: its chapter, the weapon (a button that opens the step) and its level. */
function StepHead({
  step,
  levels,
  onOpen,
}: {
  step: Step & { build: NonNullable<Step["build"]> };
  levels: string;
  onOpen?: (stepId: string) => void;
}) {
  const t = useTranslations();
  const w = getWeapon(step.build.weaponId);
  return (
    <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
      {step.chapterId && (
        <span className="bg-primary text-primary-foreground rounded-full border-[1.5px] px-1.5 text-[10px]">
          {t("reference.chapterShort", { n: step.chapterId })}
        </span>
      )}
      <button
        type="button"
        onClick={() => onOpen?.(step.id)}
        className="decoration-primary/70 min-w-0 flex-1 truncate text-left underline decoration-2 underline-offset-2"
      >
        {finalWeaponIds.includes(w.id) ? "★ " : ""}
        {w.name}
      </button>
      <span className="text-xs">{levels}</span>
    </div>
  );
}

/** Map: one card per work step with every stat at its start and end. */
export function PlanStepMap({
  guide,
  derived,
  onOpenStep,
}: {
  guide: Guide;
  derived: DerivedBuild;
  onOpenStep?: (stepId: string) => void;
}) {
  const t = useTranslations();
  const steps = workSteps(guide);
  return (
    <div className="bg-card overflow-x-auto rounded-lg border-2 p-1.5">
      <ol className="flex w-max flex-col items-stretch sm:flex-row">
        {steps.map((s, i) => {
          const d = derived.steps.get(s.id);
          const w = getWeapon(s.build.weaponId);
          if (!d) return null;
          const start: Stat = { ...d.start?.stats, du: d.start?.du ?? 0 };
          const end: Stat = { ...d.stats, du: d.du ?? 0 };
          const max: Stat = { ...w.maxStats, du: w.maxDu };
          return (
            <li key={s.id} className="flex flex-col items-stretch sm:flex-row">
              {i > 0 && (
                <span
                  aria-label={t("plan.buildsUp")}
                  className="grid place-items-center px-1.5 text-xl font-extrabold"
                >
                  <span className="rotate-90 sm:rotate-0">→</span>
                </span>
              )}
              <div className="bg-background flex w-full flex-col gap-1 rounded-xl border-2 p-2 sm:w-[210px]">
                <StepHead
                  step={s}
                  levels={`+${d.start?.level ?? 0} → +${d.level}`}
                  onOpen={onOpenStep}
                />
                <span className="text-muted-foreground text-[11px]">
                  {[
                    t("plan.absN", { n: Math.round(d.cost.abs).toLocaleString("en") }),
                    d.spheres.length > 0 && t("plan.spheresN", { n: d.spheres.length }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <table className="w-full border-collapse text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-muted-foreground text-[9px]">
                      <th />
                      <th className="text-right font-semibold">{t("plan.start")}</th>
                      <th />
                      <th className="text-right font-semibold">{t("plan.end")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {CARD_STATS.map((k) => {
                      const a = start[k] ?? 0;
                      const b = end[k] ?? 0;
                      const m = max[k] || 1;
                      return (
                        <tr key={k}>
                          <th className="text-muted-foreground w-5 text-left font-bold">
                            {t(`stat.short.${k}` as const)}
                          </th>
                          <td className="w-7 text-right">{a}</td>
                          <td className="px-1.5">
                            <span
                              aria-hidden
                              className="block h-[7px] rounded-full border"
                              style={{
                                background: `linear-gradient(90deg, var(--secondary) ${(100 * a) / m}%, var(--accent) ${(100 * a) / m}% ${(100 * b) / m}%, transparent ${(100 * b) / m}%)`,
                              }}
                            />
                          </td>
                          <td className={cn("w-7 text-right", b > a && "font-extrabold")}>{b}</td>
                          <td className="text-muted-foreground w-8 text-right text-[10px]">
                            {b > a ? `+${b - a}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** An item list with a cart button that adds every item to the shopping list. */
function ItemList({ title, items, what }: { title: string; items: ItemUse[]; what: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[9.5px] font-bold tracking-wider uppercase">
          {title}
        </span>
        <AddToListButton
          name={what}
          onAdd={() =>
            items.forEach((i) => addShoppingGoal({ kind: "item", name: i.name, qty: i.count }))
          }
        />
      </div>
      <ul className="text-[11.5px]">
        {items.map((i) => (
          <li
            key={i.name}
            className="border-border/25 flex justify-between gap-1.5 border-b border-dashed px-1 py-px"
          >
            <span>{i.name}</span>
            <b className="tabular-nums">{i.count}×</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

const plus = (g: Stat) => (k: CardStat) => ({
  text: g[k] ? `+${g[k]}` : "0",
  zero: !g[k],
});

/** The items synthed into a sphere's weapons (merged by name). */
function recipeItems(r: Recipe): ItemUse[] {
  const m = new Map<string, number>();
  for (const st of r.stages)
    for (const u of st.synths) if (u.kind === "item") m.set(u.name, (m.get(u.name) ?? 0) + u.count);
  return [...m].map(([name, count]) => ({ kind: "item", name, count }));
}

/** Detailed map: one lane per work step with the items and spheres synthed into it. */
export function PlanDetailedMap({
  guide,
  derived,
  onOpenStep,
}: {
  guide: Guide;
  derived: DerivedBuild;
  onOpenStep?: (stepId: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="bg-card overflow-x-auto rounded-lg border-2 p-1.5">
      <ol className="flex w-max flex-col items-stretch gap-3 sm:flex-row sm:items-start">
        {workSteps(guide).map((s) => {
          const d = derived.steps.get(s.id);
          const straight = s.build.synths.filter((u): u is ItemUse => u.kind === "item");
          const spheres = s.build.synths.filter((u) => u.kind === "sphere");
          const total: Stat = {};
          spheres.forEach((_, i) => {
            const g = d?.spheres[i];
            if (!g) return;
            for (const k of CARD_STATS)
              total[k] = (total[k] ?? 0) + ((k === "du" ? g.du : g.gains[k]) ?? 0);
          });
          return (
            <li
              key={s.id}
              className="bg-background flex w-full flex-col gap-1.5 rounded-xl border-2 p-2 sm:w-[260px]"
            >
              <StepHead step={s} levels={`+${d?.level ?? s.build.levelTo}`} onOpen={onOpenStep} />
              <span className="text-muted-foreground text-[11px]">
                {[
                  t("plan.spheresN", { n: spheres.length }),
                  straight.length > 0 &&
                    t("plan.itemsStraightN", { n: straight.reduce((a, x) => a + x.count, 0) }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {straight.length > 0 && (
                <div className="bg-card rounded-lg border-2 border-dashed p-1.5">
                  <ItemList
                    title={t("plan.straightOn")}
                    items={straight}
                    what={t("plan.itemsFor", { what: getWeapon(s.build.weaponId).name })}
                  />
                </div>
              )}
              <ol className="flex flex-col gap-1.5">
                {spheres.map((u, i) => {
                  if (u.kind !== "sphere") return null;
                  const g = d?.spheres[i];
                  const last = u.recipe.stages.at(-1)!;
                  const name = `${getWeapon(last.weaponId).name} +${last.levelTo}`;
                  const items = recipeItems(u.recipe);
                  return (
                    <li
                      key={i}
                      className="bg-card shadow-sticker-sm flex flex-col gap-1 rounded-[10px] border-2 p-1.5"
                    >
                      <span className="text-xs font-bold">
                        {u.recipe.stages.map((st, j) => (
                          <span key={j}>
                            {j > 0 && " → "}
                            {getWeapon(st.weaponId).name}{" "}
                            <span className="text-muted-foreground">+{st.levelTo}</span>
                          </span>
                        ))}
                      </span>
                      <span className="text-muted-foreground text-[10.5px]">
                        {u.prepared ? t("plan.madeEarlier") : acquireText(t, u.recipe.acquire)}
                      </span>
                      {items.length > 0 ? (
                        <ItemList
                          title={t("plan.itemsToSynth")}
                          items={items}
                          what={t("plan.itemsFor", { what: name })}
                        />
                      ) : (
                        <span className="text-muted-foreground text-[10.5px]">
                          {t("plan.levelledOnly")}
                        </span>
                      )}
                      {g && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground text-[9.5px] font-bold tracking-wider uppercase">
                            {t("plan.passesOn")}
                          </span>
                          <StatPairs
                            values={plus({ ...g.gains, du: g.du })}
                            className="overflow-hidden rounded-md border-[1.5px] font-extrabold"
                          />
                          {g.abilities.length > 0 && (
                            <span className="text-[11px] font-bold">
                              {g.abilities
                                .map((a) => t(`ability.${a as AbilityId}` as const))
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {spheres.length > 0 ? (
                <div className="flex flex-col gap-0.5 border-t-2 pt-1.5">
                  <span className="text-muted-foreground text-[9.5px] font-bold tracking-wider uppercase">
                    {t("plan.spheresAdd")}
                  </span>
                  <StatPairs
                    values={plus(total)}
                    className="bg-accent/45 overflow-hidden rounded-md border-[1.5px] font-extrabold"
                  />
                </div>
              ) : (
                straight.length === 0 && (
                  <span className="text-muted-foreground text-[10.5px]">
                    {t("plan.nothingSynthed")}
                  </span>
                )
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
