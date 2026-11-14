import { STAT_KEYS } from "@/lib/schemas";
import { useTranslations, type Translate } from "@/i18n";
import type { DerivedStep } from "@/lib/guide/derive";
import type { Step } from "@/lib/guide/types";
import { chapterById, sectionById } from "@/lib/data";
import { getWeapon, itemAvailability } from "@/lib/planner/sources";
import { enemyFirstSection } from "@/lib/planner/timeline";
import { cn } from "cn";
import type { Acquire, Recipe, Stage } from "@/lib/planner/types";

const name = (id: string) => getWeapon(id).name;

export function acquireText(t: Translate, a: Acquire) {
  if (a.kind === "shop") return t("planner.acquire.shop", { shop: a.shop, price: a.price });
  if (a.kind === "invent") return t("planner.acquire.invent", { gilda: a.gilda });
  return t("planner.acquire.have");
}

type Group =
  | { kind: "item"; name: string; count: number }
  | { kind: "sphere"; recipe: Recipe; count: number };

/** Merges identical sphere recipes so "3 × Heavy Hammer +5" reads as one line. */
function groupSynths(stage: Stage): Group[] {
  const groups: Group[] = [];
  for (const s of stage.synths) {
    if (s.kind === "item") {
      groups.push({ kind: "item", name: s.name, count: s.count });
      continue;
    }
    const key = JSON.stringify(s.recipe);
    const same = groups.find((g) => g.kind === "sphere" && JSON.stringify(g.recipe) === key);
    if (same) same.count++;
    else groups.push({ kind: "sphere", recipe: s.recipe, count: 1 });
  }
  return groups;
}

export function RecipeView({ recipe }: { recipe: Recipe }) {
  const t = useTranslations();
  return (
    <ol className="text-muted-foreground mt-1 flex list-decimal flex-col gap-1 pl-5 text-xs">
      <li>
        {t("planner.step.acquire", { weapon: name(recipe.stages[0].weaponId) })}:{" "}
        {acquireText(t, recipe.acquire)}
      </li>
      {recipe.stages.map((s, i) => (
        <li key={i}>
          {name(s.weaponId)} +{s.levelTo}
          {s.synths.length > 0 &&
            ` · ${s.synths.map((x) => (x.kind === "item" ? `${x.count}× ${x.name}` : "sphere")).join(", ")}`}
          {i < recipe.stages.length - 1 &&
            ` → ${t("planner.step.buildup", { weapon: name(recipe.stages[i + 1].weaponId) })}`}
        </li>
      ))}
    </ol>
  );
}

/** One weapon-build stage: what to do and what the weapon looks like afterwards (derived by the simulator). */
export function BuildStepBody({
  step,
  derived,
  buyableOnly = false,
}: {
  step: Step;
  derived?: DerivedStep;
  /** When set, a warning is shown if the step uses items that can't be bought. */
  buyableOnly?: boolean;
}) {
  const t = useTranslations();
  const stage = step.build;
  if (!stage) return null;
  const groups = groupSynths(stage);
  const foundItems = [
    ...new Set(
      groups.flatMap((g) =>
        g.kind === "item" && itemAvailability(g.name).kind === "found" ? [g.name] : [],
      ),
    ),
  ];
  const last = (r: Recipe) => r.stages[r.stages.length - 1];
  const items = groups.filter((g) => g.kind === "item");
  const spheres = groups.filter((g) => g.kind === "sphere");
  const weapon = getWeapon(stage.weaponId);
  const chapter = step.chapterId ? chapterById.get(step.chapterId) : undefined;
  const section = step.sectionId ? sectionById.get(step.sectionId) : undefined;
  const next = derived?.nextWeaponId ? getWeapon(derived.nextWeaponId) : undefined;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {chapter?.phase === "main" && (
        <p className="text-muted-foreground text-xs font-medium">
          {section
            ? t("planner.step.when", { section: section.title, n: chapter.number })
            : t("planner.step.whenChapter", { n: chapter.number })}
        </p>
      )}
      {stage.levelTo > 0 && (
        <p>{t("planner.step.levelOnly", { weapon: name(stage.weaponId), to: stage.levelTo })}</p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("planner.step.synths")}>
          {items.map((g, i) => {
            const found = itemAvailability(g.name).kind === "found";
            return (
              <li
                key={i}
                className={cn(
                  "bg-card rounded-full border-2 px-2.5 py-0.5 text-xs font-medium",
                  found && "border-dashed",
                )}
                title={found ? t("items.foundOnly") : undefined}
              >
                {g.count > 1 ? `${g.count}× ` : ""}
                {g.name}
                {found && <span className="sr-only"> ({t("items.foundOnly")})</span>}
              </li>
            );
          })}
        </ul>
      )}
      {spheres.map((g, i) => (
        <div key={i}>
          <p>
            {t(g.count > 1 ? "planner.step.sphereCount" : "planner.step.sphere", {
              count: g.count,
              weapon: name(last(g.recipe).weaponId),
              level: last(g.recipe).levelTo,
              sp: last(g.recipe).levelTo,
            })}
          </p>
          <details>
            <summary className="text-muted-foreground cursor-pointer text-xs">
              {t("planner.step.prepare")}
            </summary>
            <RecipeView recipe={g.recipe} />
          </details>
        </div>
      ))}
      {buyableOnly && foundItems.length > 0 && (
        <p className="text-destructive text-xs">
          {t("step.foundItems", { items: foundItems.join(", ") })}
        </p>
      )}
      {derived && (
        <>
          <p className="text-muted-foreground text-xs">
            {t("planner.step.cost", {
              abs: Math.round(derived.cost.abs).toLocaleString(),
              gilda: Math.round(derived.cost.gilda).toLocaleString(),
            })}{" "}
            · {t("planner.after", { level: derived.level, sp: derived.sp })}
          </p>
          <details className="group">
            <summary className="text-muted-foreground cursor-pointer text-xs">
              {t("planner.step.stats")}
            </summary>
            <p className="text-muted-foreground mt-1 text-[0.7rem]">
              {t(
                derived.nextWeaponId ? "planner.step.statsLegendNeeds" : "planner.step.statsLegend",
              )}
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
              {STAT_KEYS.map((k) => {
                const need = derived.requirements?.[k] ?? 0;
                const max = weapon.maxStats[k] || 1;
                const pct = (n: number) => `${Math.min(100, (100 * n) / max)}%`;
                return (
                  <div
                    key={k}
                    className={cn(
                      "flex flex-col gap-0.5",
                      need > derived.stats[k] && "text-destructive",
                    )}
                  >
                    <span className="flex justify-between gap-1">
                      <span className="truncate">{t(`stat.${k}` as const)}</span>
                      <span className="tabular-nums">
                        <span className="font-semibold">{derived.stats[k]}</span>
                        <span className="text-muted-foreground"> / {weapon.maxStats[k]}</span>
                      </span>
                    </span>
                    {/* The bar fills to the stat; a tick marks what the next weapon needs. */}
                    <span aria-hidden className="bg-muted relative h-1 rounded-full">
                      <span
                        className="bg-primary block h-full rounded-full"
                        style={{ width: pct(derived.stats[k]) }}
                      />
                      {need > 0 && (
                        <span
                          className="bg-foreground absolute -top-0.5 h-2 w-0.5 -translate-x-1/2"
                          style={{ left: pct(need) }}
                        />
                      )}
                    </span>
                    {need > 0 && (
                      <span className="text-muted-foreground text-[0.7rem] tabular-nums">
                        {t("planner.step.needs", { n: need })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
          {next && (
            <p className="font-medium">{t("planner.step.buildup", { weapon: next.name })}</p>
          )}
          {next && next.requiresKills.length > 0 && (
            <div className="text-xs">
              <p>{t("planner.step.kills", { weapon: next.name })}</p>
              <ul
                className="list-disc pl-5"
                aria-label={t("planner.step.kills", { weapon: next.name })}
              >
                {next.requiresKills.map((enemy) => {
                  const met = enemyFirstSection(enemy);
                  const where = met ? sectionById.get(met) : undefined;
                  const ch = where ? chapterById.get(where.chapterId) : undefined;
                  return (
                    <li key={enemy}>
                      <span className="font-medium">{enemy}</span>
                      {where && (
                        <span className="text-muted-foreground">
                          {" "}
                          ·{" "}
                          {t("planner.step.metAt", {
                            section: where.title,
                            n: ch?.number ?? where.chapterId,
                          })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {derived.errors.length > 0 && (
            <div className="text-destructive text-xs">
              <p className="font-medium">{t("step.problems")}</p>
              <ul className="list-disc pl-5">
                {derived.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
