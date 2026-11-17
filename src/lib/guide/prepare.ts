// Spreading a story guide's sphere work over the story: the side weapons a work step synths as
// spheres can often be levelled chapters earlier and kept, instead of all at once in that step.
import { core } from "@/lib/gamedata";
import { chapters } from "@/lib/data";
import { enemyChapter, stageResourceChapter } from "@/lib/planner/timeline";
import { getWeapon } from "@/lib/planner/sources";
import { simulateRecipe } from "@/lib/planner/simulate";
import type { Recipe } from "@/lib/planner/types";
import { deriveBuild } from "./derive";
import type { Guide, Step } from "./types";

/** ABS the story pays in each chapter (index 1…8), clearing every section once. */
const chapterAbs: number[] = (() => {
  const out = Array<number>(9).fill(0);
  for (const s of core.sections) out[s.chapterNumber] += s.abs ?? 0;
  return out;
})();

const chapterNumber = (id: string | undefined) =>
  chapters.find((c) => c.id === id)?.number ?? Number(id ?? 8);
const chapterIdOf = (n: number) => chapters.find((c) => c.number === n)?.id ?? String(n);

/** The first chapter a side weapon can be made in: its purchase, items, spheres and build-up kills. */
export function readyChapter(r: Recipe): number {
  let ch = r.acquire.kind === "have" ? 1 : r.acquire.chapter;
  r.stages.forEach((st, i) => {
    ch = Math.max(ch, stageResourceChapter(st));
    if (i > 0)
      for (const e of getWeapon(st.weaponId).requiresKills)
        ch = Math.max(ch, enemyChapter.get(e) ?? 8);
  });
  return ch;
}

/**
 * Moves the side weapons of each work step's spheres into "prepare" steps in earlier chapters (from
 * chapter 2 and once the side weapon can be made), where the story pays enough ABS: each goes to the chapter whose story ABS is least used by then, so the
 * levelling is spread out rather than piled into the step that synths them. The spheres stay in
 * their step, marked `prepared`.
 */
export function prepareSpheresEarly(guide: Guide): Guide {
  if (!guide.build) return guide;
  const derived = deriveBuild(guide);
  const opts = { spBonus: guide.build.spBonus };
  const work = guide.steps.filter((s) => s.build);
  // ABS already spent in each chapter by the work steps.
  const load = Array<number>(9).fill(0);
  for (const s of work) load[chapterNumber(s.chapterId)] += derived.steps.get(s.id)?.cost.abs ?? 0;

  const steps: Step[] = structuredClone(guide.steps);
  /** Prepared recipes per (work step id, chapter). */
  const moved = new Map<string, Map<number, Recipe[]>>();
  for (const s of steps) {
    if (!s.build) continue;
    const C = chapterNumber(s.chapterId);
    const candidates = s.build.synths
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => u.kind === "sphere" && !u.prepared)
      .map(({ u, i }) => {
        const recipe = (u as { recipe: Recipe }).recipe;
        return {
          i,
          recipe,
          abs: simulateRecipe(recipe, opts).cost.abs,
          ready: readyChapter(recipe),
        };
      })
      .sort((a, b) => b.abs - a.abs);
    for (const c of candidates) {
      let best: number | undefined;
      let bestUse = Infinity;
      // From chapter 2 (allies along), as soon as the side weapon can be made.
      for (let ch = Math.max(2, c.ready); ch < C; ch++) {
        const use = (load[ch] + c.abs) / (chapterAbs[ch] || Infinity);
        if (use <= 1 && use < bestUse) {
          best = ch;
          bestUse = use;
        }
      }
      if (best === undefined) continue;
      load[best] += c.abs;
      load[C] -= c.abs;
      s.build.synths[c.i] = { kind: "sphere", recipe: c.recipe, prepared: true };
      const byChapter = moved.get(s.id) ?? new Map<number, Recipe[]>();
      byChapter.set(best, [...(byChapter.get(best) ?? []), c.recipe]);
      moved.set(s.id, byChapter);
    }
  }
  if (!moved.size) return guide;

  // Insert each prepare step after the last step of its chapter (before the step that uses it).
  const used = new Set(steps.map((s) => s.id));
  const out: Step[] = [...steps];
  for (const [stepId, byChapter] of moved) {
    const weaponId = steps.find((s) => s.id === stepId)!.build!.weaponId;
    for (const [ch, recipes] of [...byChapter].sort((a, b) => a[0] - b[0])) {
      let id = `prep-${weaponId}-${ch}`;
      for (let n = 2; used.has(id); n++) id = `prep-${weaponId}-${ch}-${n}`;
      used.add(id);
      const target = out.findIndex((s) => s.id === stepId);
      let at = out.findIndex((s) => chapterNumber(s.chapterId) > ch);
      if (at < 0 || at > target) at = target;
      out.splice(at, 0, {
        id,
        title: `Spheres for ${getWeapon(weaponId).name}`,
        notes: "",
        chapterId: chapterIdOf(ch),
        entries: [],
        prepare: { weaponId, recipes },
      });
    }
  }
  return { ...guide, steps: out };
}
