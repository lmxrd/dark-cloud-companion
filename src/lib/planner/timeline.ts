// Places a plan's stages on the story: each stage happens after the section (floor, fight, story
// beat) by which everything it needs is available and, depending on the flow, enough ABS and gilda
// have been earned. Both come from clearing each section once in play order; all ABS goes to the
// weapon being built (from when it is obtained), gilda is the player's from the start. Whatever a
// stage still lacks has to be ground out.
import { core, names } from "@/lib/gamedata";
import { weapons as weaponsFile } from "@/lib/gamedata/weapons";
import { stageResourceChapter } from "@/lib/guides/fromPlan";
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

const enemyIdByName = new Map(Object.entries(names.enemies).map(([id, name]) => [name, id]));
const lastIndex = sections.length - 1;

/** The section index from which something available "in chapter n" can be done. */
const fromChapter = (n: number) => chapterStart.get(Math.min(Math.max(n, 1), 8)) ?? lastIndex;

/** The section after which the enemy has been met (and can be defeated). */
function killIndex(enemyName: string): number {
  const id = enemyIdByName.get(enemyName);
  const section = id ? weaponsFile.killEnemySections[id] : undefined;
  return section !== undefined ? (indexOfSection.get(section) ?? lastIndex) : lastIndex;
}

/** The earliest section index at which a stage's items, sphere weapons and the next build-up's kills are all available. */
export function stageUnlockIndex(
  stage: Stage,
  next: Stage | undefined,
  killsOf: (weaponId: string) => string[],
): number {
  let i = fromChapter(stageResourceChapter(stage));
  if (next) for (const e of killsOf(next.weaponId)) i = Math.max(i, killIndex(e));
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
      // Wait for the ABS and gilda, as long as the story has sections left.
      while (at < lastIndex && (absPool + absBetween(counted, at) < abs || gildaAt(at) < gilda))
        at++;
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
