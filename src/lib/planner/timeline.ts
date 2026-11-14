// Places a plan's stages on the story: each stage happens after the section (floor, fight, story
// beat) by which everything it needs is available and, depending on the flow, enough ABS and gilda
// have been earned. Both come from clearing each section once in play order; all ABS goes to the
// weapon being built (from when it is obtained), gilda is the player's from the start. Whatever a
// stage still lacks has to be ground out.
import { core, names } from "@/lib/gamedata";
import { weapons as weaponsFile } from "@/lib/gamedata/weapons";
import { stageResourceChapter } from "@/lib/guides/fromPlan";
import { getWeapon } from "./sources";
import type { Acquire, Stage } from "./types";

/**
 * `earliest`: every stage as soon as it is unlocked, grinding whatever ABS or gilda is missing.
 * `story`: a stage waits until the story has provided its ABS and gilda; grinding only when the
 * story runs out.
 */
export type Flow = "earliest" | "story";

/** Sections in play order. */
const sections = core.sections;
const indexOfSection = new Map(sections.map((s, i) => [s.id, i]));
/** Index of the first section of each chapter. */
const chapterStart = new Map<number, number>();
sections.forEach((s, i) => {
  if (!chapterStart.has(s.chapterNumber)) chapterStart.set(s.chapterNumber, i);
});
/** ABS and gilda earned by clearing sections 0…i once. */
const absUpTo: number[] = [];
const gildaUpTo: number[] = [];
sections.reduce((sum, s, i) => (absUpTo[i] = sum + (s.abs ?? 0)), 0);
sections.reduce((sum, s, i) => (gildaUpTo[i] = sum + (s.gilda ?? 0)), 0);
const absBetween = (from: number, to: number) =>
  to < 0 ? 0 : absUpTo[to] - (from < 0 ? 0 : absUpTo[from]);

/** Gilda the story has paid out by the end of a chapter. */
export function storyGilda(chapter: number): number {
  let last = -1;
  sections.forEach((s, i) => s.chapterNumber <= chapter && (last = i));
  return last < 0 ? 0 : gildaUpTo[last];
}

/** Every enemy id per name: some names are shared (e.g. a boss met again later on). */
const enemyIdsByName = new Map<string, string[]>();
for (const [id, name] of Object.entries(names.enemies))
  enemyIdsByName.set(name, [...(enemyIdsByName.get(name) ?? []), id]);
const lastIndex = sections.length - 1;

/** The section index from which something available "in chapter n" can be done. */
const fromChapter = (n: number) => chapterStart.get(Math.min(Math.max(n, 1), 8)) ?? lastIndex;

/** Section indexes where an enemy (by name) is met: every namesake's. */
const meetings = (enemyName: string) =>
  (enemyIdsByName.get(enemyName) ?? [])
    .map((id) => weaponsFile.killEnemySections[id])
    .map((section) => (section !== undefined ? indexOfSection.get(section) : undefined))
    .filter((i): i is number => i !== undefined);

/** The section after which the enemy has been met (and can be defeated): the earliest of its namesakes. */
function killIndex(enemyName: string): number {
  const found = meetings(enemyName);
  return found.length ? Math.min(...found) : lastIndex;
}

/**
 * Where a build-up into `weaponId` happens: after the section of the work before it, and once every
 * enemy the weapon needs defeated has been met.
 */
export function buildUpSection(
  afterSectionId: string,
  weaponId: string,
): { sectionId: string; chapter: number } {
  const i = Math.max(
    indexOfSection.get(afterSectionId) ?? 0,
    ...getWeapon(weaponId).requiresKills.map(killIndex),
  );
  return { sectionId: sections[i].id, chapter: sections[i].chapterNumber };
}

/** The section in which an enemy (by name) is first met, if known. */
export function enemyFirstSection(enemyName: string): string | undefined {
  const found = meetings(enemyName);
  return found.length ? sections[Math.min(...found)].id : undefined;
}

/** The earliest section index at which a stage's items, sphere weapons and the next build-up's kills are all available. */
export function stageUnlockIndex(
  stage: Stage,
  next: Stage | undefined,
  killsOf: (weaponId: string) => string[],
): number {
  let i = fromChapter(stageResourceChapter(stage));
  if (next && next.weaponId !== stage.weaponId)
    for (const e of killsOf(next.weaponId)) i = Math.max(i, killIndex(e));
  return i;
}

export interface PlacedStage {
  /** The section after which the stage is done. */
  sectionId: string;
  chapter: number;
  /** ABS the story hasn't provided by then, to be ground out. */
  grindAbs: number;
  /** Gilda the story hasn't paid out by then, to be farmed. */
  grindGilda: number;
}

/**
 * Places stages on the story. `cost` is each stage's own ABS and gilda (from the simulator; the
 * first weapon's price belongs to the first stage), `unlocks` each stage's unlock index
 * (`stageUnlockIndex`), and `acquire` how the first weapon is obtained.
 */
export function placeStages(
  cost: { abs: number; gilda: number }[],
  unlocks: number[],
  acquire: Acquire | undefined,
  flow: Flow,
  /** Chapter each stage must be done by (the story flow stops waiting there and grinds the rest). */
  deadlines?: number[],
): PlacedStage[] {
  let t = acquire && acquire.kind !== "have" ? fromChapter(acquire.chapter) : 0;
  // ABS from sections cleared after the weapon is obtained (the section it's obtained in counts).
  let absPool = 0;
  let counted = t - 1;
  // Gilda earned minus gilda spent so far (earning starts with the game; grinding makes up shortfalls).
  let gildaGround = 0;
  let gildaSpent = 0;
  const gildaAt = (i: number) => gildaUpTo[i] + gildaGround - gildaSpent;
  return cost.map(({ abs, gilda }, i) => {
    let at = Math.max(t, unlocks[i]);
    if (flow === "story") {
      // Wait for the ABS and gilda, as long as the story (or the stage's chapter) has sections left.
      const deadline = deadlines?.[i];
      const last =
        deadline === undefined
          ? lastIndex
          : Math.max(at, (chapterStart.get(deadline + 1) ?? lastIndex + 1) - 1);
      while (at < last && (absPool + absBetween(counted, at) < abs || gildaAt(at) < gilda)) at++;
    }
    absPool += absBetween(counted, at);
    counted = at;
    const grindAbs = Math.max(0, Math.ceil(abs - absPool));
    absPool = Math.max(0, absPool - abs);
    const grindGilda = Math.max(0, Math.ceil(gilda - gildaAt(at)));
    gildaGround += grindGilda;
    gildaSpent += gilda;
    t = at;
    const s = sections[at];
    return { sectionId: s.id, chapter: s.chapterNumber, grindAbs, grindGilda };
  });
}
