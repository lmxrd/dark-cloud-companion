// Splitting a story guide's work steps by chapter after solving: the solver gives a weapon one work
// stage (plus an in-between one when its build-up waits for kills), so everything on it happens in
// the chapter its last part needs. Parts available earlier (spheres whose side weapons can be made,
// items on sale) move into an earlier step on the same weapon, after the build-up into it, when the
// story's ABS and gilda by then (plus the grind allowance) cover them and the simulator still gives
// a valid build that ends as strong.
import { core } from "@/lib/gamedata";
import { chapters } from "@/lib/data";
import { stageResourceChapter } from "@/lib/guides/fromPlan";
import { getWeapon } from "@/lib/planner/sources";
import type { SynthUse } from "@/lib/planner/types";
import { STAT_KEYS } from "@/lib/schemas";
import { deriveBuild, type DerivedBuild } from "./derive";
import { readyChapter } from "./prepare";
import type { Guide, Step } from "./types";

export interface SplitBudget {
  /** ABS grind allowed on top of what the story pays by a chapter, as a share of it. */
  absGrindShare: number;
  /** The same for gilda. */
  gildaGrindShare: number;
}

/** ABS and gilda the story pays by the end of each chapter (index 1…8), clearing every section once. */
const storyBy = (() => {
  const abs = Array<number>(9).fill(0);
  const gilda = Array<number>(9).fill(0);
  for (const s of core.sections)
    for (let c = s.chapterNumber; c <= 8; c++) {
      abs[c] += s.abs ?? 0;
      gilda[c] += s.gilda ?? 0;
    }
  return { abs, gilda };
})();

const chapterNumber = (id: string | undefined) =>
  chapters.find((c) => c.id === id)?.number ?? Number(id ?? 8);
const chapterIdOf = (n: number) => chapters.find((c) => c.number === n)?.id ?? String(n);

/** The first chapter a synth can be done in: its item on sale, or its side weapon made. */
function synthChapter(u: SynthUse): number {
  if (u.kind === "sphere") return u.prepared ? 1 : readyChapter(u.recipe);
  return stageResourceChapter({ weaponId: "", levelTo: 0, synths: [u] });
}

/** ABS and gilda spent by the end of each chapter (index 1…8) by a guide's steps. */
function spentBy(guide: Guide, d: DerivedBuild) {
  const abs = Array<number>(9).fill(0);
  const gilda = Array<number>(9).fill(0);
  for (const s of guide.steps) {
    const cost = d.steps.get(s.id)?.cost;
    if (!cost) continue;
    for (let c = chapterNumber(s.chapterId); c <= 8; c++) {
      abs[c] += cost.abs;
      gilda[c] += cost.gilda;
    }
  }
  return { abs, gilda };
}

const problems = (d: DerivedBuild) =>
  d.errors.length + [...d.steps.values()].reduce((n, s) => n + s.errors.length, 0);

/** The split guide ends at least as strong: same weapon, every stat and ability. */
function endsAsStrong(a: DerivedBuild, b: DerivedBuild): boolean {
  if (!a.final || !b.final || a.final.weaponId !== b.final.weaponId) return false;
  return (
    STAT_KEYS.every((k) => b.final!.stats[k] >= a.final!.stats[k]) &&
    a.final.abilities.every((x) => b.final!.abilities.includes(x))
  );
}

/**
 * Splits each work step whose weapon is held chapters before the step: the parts available in an
 * earlier chapter (from chapter 2, allies along) go into a new step on the same weapon there, levelled
 * just enough for their SP. Earlier chapters are tried first; a split that the budget or the
 * simulator rejects is left out.
 */
export function splitStepsEarly(guide: Guide, budget: SplitBudget): Guide {
  if (!guide.build) return guide;
  let current = guide;
  let derived = deriveBuild(current);
  if (problems(derived)) return guide;
  const used = new Set(guide.steps.map((s) => s.id));
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    return id;
  };

  for (let i = 0; i < current.steps.length; i++) {
    const step = current.steps[i];
    if (!step.build) continue;
    const C = chapterNumber(step.chapterId);
    const prev = current.steps[i - 1];
    // When the weapon is first held: the build-up into it, the step before on it, or the start.
    const heldFrom = prev
      ? chapterNumber(prev.chapterId)
      : current.build!.acquire && current.build!.acquire.kind !== "have"
        ? current.build!.acquire.chapter
        : 1;
    // A step before on the same weapon already does its chapter's work.
    const from = Math.max(2, heldFrom + (prev?.build?.weaponId === step.build.weaponId ? 1 : 0));
    for (let ch = from; ch < C; ch++) {
      const s = current.steps[i];
      const early = s.build!.synths.filter((u) => synthChapter(u) <= ch);
      if (!early.length) continue;
      const late = s.build!.synths.filter((u) => synthChapter(u) > ch);
      const before = spentBy(current, derived);
      let accepted: { guide: Guide; derived: DerivedBuild } | undefined;
      // The least level that pays the early parts' SP.
      const held = derived.steps.get(s.id)?.start?.level ?? 0;
      for (let level = held; level <= s.build!.levelTo && !accepted; level++) {
        const id = uniqueId(`${s.build!.weaponId}+${level}`);
        const first: Step = {
          id,
          title: getWeapon(s.build!.weaponId).name,
          notes: "",
          chapterId: chapterIdOf(ch),
          entries: [],
          build: { weaponId: s.build!.weaponId, levelTo: level, synths: early },
        };
        const rest: Step = { ...s, build: { ...s.build!, synths: late } };
        const steps = [...current.steps];
        steps.splice(i, 1, first, rest);
        const candidate: Guide = { ...current, steps };
        const d = deriveBuild(candidate);
        if (problems(d) || !endsAsStrong(derived, d)) continue;
        // Within the story's ABS and gilda (plus grinding) in every chapter it moves work into, or
        // no worse than before where the plan already grinds.
        const after = spentBy(candidate, d);
        const fits = [...Array(C - ch).keys()].every((n) => {
          const c = ch + n;
          return (
            after.abs[c] <= Math.max(before.abs[c], storyBy.abs[c] * (1 + budget.absGrindShare)) &&
            after.gilda[c] <=
              Math.max(before.gilda[c], storyBy.gilda[c] * (1 + budget.gildaGrindShare))
          );
        });
        if (fits) accepted = { guide: candidate, derived: d };
      }
      if (!accepted) continue;
      used.add(accepted.guide.steps[i].id);
      current = accepted.guide;
      derived = accepted.derived;
      i++; // the rest of the step is now at i; later chapters split it further
    }
  }
  return current;
}
