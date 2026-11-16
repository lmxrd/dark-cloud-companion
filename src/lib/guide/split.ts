// Splitting a story guide's work steps by chapter after solving: the solver gives a weapon one work
// stage (plus an in-between one when its build-up waits for kills), so everything on it happens in
// the chapter its last part needs. Parts available earlier (spheres whose side weapons can be made,
// items on sale) move into an earlier step on the same weapon, after the build-up into it, when the
// story's ABS and gilda by then (plus the grind allowance) cover them and the simulator still gives
// a valid build that ends as strong. A sphere on a later weapon that is ready chapters before it moves
// onto the weapon held then, the same way (stats carry over the build-ups in between).
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

/** Within the story's ABS and gilda (plus grinding) in chapters from…to−1, or no worse than before. */
function fits(
  before: ReturnType<typeof spentBy>,
  after: ReturnType<typeof spentBy>,
  from: number,
  to: number,
  budget: SplitBudget,
): boolean {
  for (let c = from; c < to; c++)
    if (
      after.abs[c] > Math.max(before.abs[c], storyBy.abs[c] * (1 + budget.absGrindShare)) ||
      after.gilda[c] > Math.max(before.gilda[c], storyBy.gilda[c] * (1 + budget.gildaGrindShare))
    )
      return false;
  return true;
}

/** Each weapon's run of work steps: when it is first held and its steps' indices. */
function weaponRuns(guide: Guide) {
  const runs: { weaponId: string; from: number; steps: number[] }[] = [];
  guide.steps.forEach((s, i) => {
    if (!s.build) return;
    const last = runs[runs.length - 1];
    if (last?.weaponId === s.build.weaponId) {
      last.steps.push(i);
      return;
    }
    const prev = guide.steps[i - 1];
    const from = prev
      ? chapterNumber(prev.chapterId)
      : guide.build!.acquire && guide.build!.acquire.kind !== "have"
        ? guide.build!.acquire.chapter
        : 1;
    runs.push({ weaponId: s.build.weaponId, from, steps: [i] });
  });
  return runs;
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
        if (fits(before, spentBy(candidate, d), ch, C, budget))
          accepted = { guide: candidate, derived: d };
      }
      if (!accepted) continue;
      used.add(accepted.guide.steps[i].id);
      current = accepted.guide;
      derived = accepted.derived;
      i++; // the rest of the step is now at i; later chapters split it further
    }
  }

  // Spheres on a later weapon that are ready chapters before it: onto the weapon held then.
  for (let si = 0; si < current.steps.length; si++) {
    const srcId = current.steps[si].id;
    for (let u = 0; u < (current.steps[si].build?.synths.length ?? 0); u++) {
      const moved = sphereEarlier(current, derived, si, u, budget, uniqueId);
      if (!moved) continue;
      used.add(moved.newId ?? "");
      current = moved.guide;
      derived = moved.derived;
      si = current.steps.findIndex((s) => s.id === srcId);
      u--; // the next synth is now at u
    }
  }
  return current;
}

/**
 * Moves synth `u` of step `si` (a sphere) onto the weapon held in the earliest chapter it is ready
 * in, before the step's chapter: into that weapon's step of the chapter, or a new step there after
 * its build-up, levelled just enough. Undefined when no chapter passes the checks.
 */
function sphereEarlier(
  guide: Guide,
  derived: DerivedBuild,
  si: number,
  u: number,
  budget: SplitBudget,
  uniqueId: (base: string) => string,
): { guide: Guide; derived: DerivedBuild; newId?: string } | undefined {
  const src = guide.steps[si];
  const synth = src.build!.synths[u];
  if (synth.kind !== "sphere") return undefined;
  const C = chapterNumber(src.chapterId);
  const runs = weaponRuns(guide);
  const srcRun = runs.findIndex((r) => r.steps.includes(si));
  const before = spentBy(guide, derived);
  for (let ch = Math.max(2, synthChapter(synth)); ch < C; ch++) {
    // The weapon held in chapter ch: the latest earlier one whose time includes it.
    const run = runs
      .slice(0, srcRun)
      .reverse()
      .find((r) => r.from <= ch && ch <= chapterNumber(guide.steps[r.steps.at(-1)!].chapterId));
    if (!run) continue;
    const join = run.steps.find((i) => chapterNumber(guide.steps[i].chapterId) === ch);
    const next = run.steps.find((i) => chapterNumber(guide.steps[i].chapterId) > ch);
    const rest = src.build!.synths.filter((_, n) => n !== u);
    const levels: number[] = [];
    let held: number;
    if (join !== undefined) {
      held = guide.steps[join].build!.levelTo;
      const cap = next !== undefined ? guide.steps[next].build!.levelTo : held;
      for (let l = held; l <= cap; l++) levels.push(l);
    } else {
      held = derived.steps.get(guide.steps[next!].id)?.start?.level ?? 0;
      for (let l = held; l <= guide.steps[next!].build!.levelTo; l++) levels.push(l);
    }
    for (const level of levels) {
      const steps = [...guide.steps];
      steps[si] = { ...src, build: { ...src.build!, synths: rest } };
      let newId: string | undefined;
      if (join !== undefined) {
        const j = steps[join];
        steps[join] = {
          ...j,
          build: { ...j.build!, levelTo: level, synths: [...j.build!.synths, synth] },
        };
      } else {
        newId = uniqueId(`${run.weaponId}+${level}`);
        steps.splice(next!, 0, {
          id: newId,
          title: getWeapon(run.weaponId).name,
          notes: "",
          chapterId: chapterIdOf(ch),
          entries: [],
          build: { weaponId: run.weaponId, levelTo: level, synths: [synth] },
        });
      }
      const candidate: Guide = { ...guide, steps };
      const d = deriveBuild(candidate);
      if (problems(d) || !endsAsStrong(derived, d)) continue;
      if (fits(before, spentBy(candidate, d), ch, C, budget))
        return { guide: candidate, derived: d, newId };
    }
  }
  return undefined;
}
