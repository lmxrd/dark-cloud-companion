import { chapters } from "@/lib/data";
import { enemyChapter, stageResourceChapter } from "@/lib/guides/fromPlan";
import type { PlanResult } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import { buildUpSection, type PlacedStage } from "@/lib/planner/timeline";
import type { Acquire } from "@/lib/planner/types";
import type { WeaponState } from "@/lib/weapons/mechanics";
import { newId, type BuildStart, type Guide, type Step } from "./types";

const chapterIdOf = (n: number) => chapters.find((c) => c.number === n)?.id;

export function stateToBuildStart(s: WeaponState, spBonus: number, acquire?: Acquire): BuildStart {
  return {
    weaponId: s.weaponId,
    level: s.level,
    abs: s.abs,
    stats: { ...s.stats },
    du: s.du,
    sp: s.sp,
    abilities: [...s.abilities],
    spBonus: spBonus ? 1 : 0,
    ...(acquire ? { acquire } : {}),
  };
}

/**
 * Turns a planner result into a guide: a step per stage (the work on one weapon) and a separate step
 * for each build-up into the next weapon. Each is placed in the earliest workable chapter, or at the
 * section `placement` gives (with a note on ABS to grind); a build-up waits for the enemies the next
 * weapon needs defeated.
 */
export function planResultToGuide(args: {
  id?: string;
  title: string;
  description?: string;
  result: PlanResult;
  start: WeaponState;
  spBonus: number;
  acquire?: Acquire;
  kind?: Guide["kind"];
  createdAt?: number;
  /** Where each stage falls in the story (see planner/timeline); without it, steps get a chapter only. */
  placement?: PlacedStage[];
}): Guide {
  const { result } = args;
  if (!result.plan || !result.chain) throw new Error("no plan to convert");
  // Work on one weapon that falls in the same chapter is one step: merge consecutive stages on the
  // same weapon placed in the same chapter (the later one's level and placement win).
  const stages: typeof result.plan.stages = [];
  const placements: (PlacedStage | undefined)[] = [];
  result.plan.stages.forEach((stage, i) => {
    const placed = args.placement?.[i];
    const prev = stages.at(-1);
    const prevPlaced = placements.at(-1);
    if (
      prev &&
      prev.weaponId === stage.weaponId &&
      placed &&
      prevPlaced?.chapter === placed.chapter
    ) {
      stages[stages.length - 1] = {
        weaponId: stage.weaponId,
        levelTo: Math.max(prev.levelTo, stage.levelTo),
        synths: [...prev.synths, ...stage.synths],
      };
      placements[placements.length - 1] = {
        ...placed,
        grindAbs: placed.grindAbs + prevPlaced.grindAbs,
        grindGilda: placed.grindGilda + prevPlaced.grindGilda,
      };
      return;
    }
    stages.push(stage);
    placements.push(placed);
  });
  let chapter = 1;
  // Step ids name what is done (weapon and level, or the build-up target), not its position, so a
  // step's tick stays with what was done when the plan is regenerated, and drops away when it's gone.
  const used = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const steps: Step[] = [];
  stages.forEach((stage, i) => {
    const placed = placements[i];
    chapter = Math.max(chapter, stageResourceChapter(stage));
    // An empty last stage only marks the weapon the build ends in: the build-up step says it.
    const emptyEnd =
      i === stages.length - 1 && i > 0 && stage.levelTo === 0 && stage.synths.length === 0;
    if (!emptyEnd)
      steps.push({
        id: uniqueId(`${stage.weaponId}+${stage.levelTo}`),
        title: getWeapon(stage.weaponId).name,
        notes: [
          placed?.grindAbs &&
            `Grind about ${placed.grindAbs.toLocaleString("en")} ABS more than the story gives by this point.`,
          placed?.grindGilda &&
            `Farm about ${placed.grindGilda.toLocaleString("en")} gilda more than the story pays by this point.`,
        ]
          .filter(Boolean)
          .join(" "),
        chapterId: chapterIdOf(placed ? placed.chapter : Math.min(chapter, 8)),
        ...(placed ? { sectionId: placed.sectionId } : {}),
        entries: [],
        build: stage,
      });
    // A next stage on the same weapon continues it (an in-between step): no build-up yet.
    const next = stages[i + 1];
    if (!next || next.weaponId === stage.weaponId) return;
    const kills = getWeapon(next.weaponId).requiresKills;
    chapter = Math.max(chapter, ...kills.map((e) => enemyChapter.get(e) ?? 8));
    const at = placed ? buildUpSection(placed.sectionId, next.weaponId) : undefined;
    steps.push({
      id: uniqueId(`to-${next.weaponId}`),
      title: `${getWeapon(stage.weaponId).name} → ${getWeapon(next.weaponId).name}`,
      notes: "",
      chapterId: chapterIdOf(at ? at.chapter : Math.min(chapter, 8)),
      ...(at ? { sectionId: at.sectionId } : {}),
      entries: [],
      buildUp: { weaponId: next.weaponId },
    });
  });
  return {
    id: args.id ?? `g-${Date.now().toString(36)}-${newId()}`,
    title: args.title,
    ...(args.description ? { description: args.description } : {}),
    kind: args.kind ?? "custom",
    build: stateToBuildStart(args.start, args.spBonus, args.acquire),
    steps,
    createdAt: args.createdAt ?? Date.now(),
    updatedAt: args.createdAt ?? Date.now(),
  };
}

/**
 * Continues a build guide with a freshly generated plan. The plan starts from the weapon the base guide ends with,
 * so its first stage is merged into the base's last build step; the remaining stages are appended.
 */
export function appendPlanToGuide(base: Guide, generated: Guide, title: string): Guide {
  const lastIdx = base.steps.findLastIndex((s) => s.build || s.buildUp);
  const genIdx = generated.steps.findIndex((s) => s.build);
  if (lastIdx < 0 || genIdx < 0) throw new Error("both guides need build steps");
  const steps = structuredClone(base.steps);
  const last = steps[lastIdx];
  const genStage = generated.steps[genIdx].build!;
  // A base ending in work on the plan's start weapon takes the plan's first stage into that step;
  // a base ending in a build-up (into the plan's start weapon) is simply continued.
  const merge = !!last.build && last.build.weaponId === genStage.weaponId;
  if (merge)
    steps[lastIdx] = {
      ...last,
      build: {
        weaponId: last.build!.weaponId,
        levelTo: Math.max(last.build!.levelTo, genStage.levelTo),
        synths: [...last.build!.synths, ...genStage.synths],
      },
    };
  const rest = generated.steps
    .slice(merge ? genIdx + 1 : genIdx)
    .filter((s) => s.build || s.buildUp);
  const now = Date.now();
  return {
    ...structuredClone(base),
    id: `g-${now.toString(36)}-${newId()}`,
    title,
    kind: "custom",
    steps: [...steps, ...rest.map((s, i) => ({ ...s, id: `p${i + 1}-${s.id}` }))],
    createdAt: now,
    updatedAt: now,
  };
}
