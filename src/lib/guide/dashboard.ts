// Which chapter the dashboard follows, and which steps of a guide belong to a chapter.
import { allMedals, chapters, checklist } from "@/lib/data";
import { checklistCategory, type ChecklistItem } from "@/lib/schemas";
import { stepTickIds } from "./progress";
import type { Guide, Step } from "./types";

const checklistById = new Map(checklist.map((i) => [i.id, i]));
const medalIds = new Set(allMedals.map((m) => m.id));

export const MAIN_CHAPTERS = chapters.filter((c) => c.phase === "main");

export interface PlacedStep {
  step: Step;
  index: number;
}

export const stepsInChapter = (guide: Guide, chapterId: string): PlacedStep[] =>
  guide.steps.map((step, index) => ({ step, index })).filter((p) => p.step.chapterId === chapterId);

export const anytimeSteps = (guide: Guide): PlacedStep[] =>
  guide.steps.map((step, index) => ({ step, index })).filter((p) => !p.step.chapterId);

const chapterNumber = (id: string | undefined) => chapters.find((c) => c.id === id)?.number;

/** Unfinished steps of earlier chapters, for guides where that matters (weapon builds, own guides). */
export function carriedSteps(
  guide: Guide,
  chapterId: string,
  isDone: (s: Step) => boolean,
): (PlacedStep & { from: number })[] {
  const current = chapterNumber(chapterId);
  if (current === undefined) return [];
  return guide.steps
    .map((step, index) => ({ step, index, from: chapterNumber(step.chapterId) }))
    .filter(
      (p): p is PlacedStep & { from: number } =>
        p.from !== undefined && p.from < current && !isDone(p.step),
    );
}

/** Progress over the given steps of several guides; ticks shared between guides (data items) count once. */
export function unionProgress(
  guides: Guide[],
  pick: (guide: Guide) => Step[],
  checks: Record<string, true>,
): { done: number; total: number } {
  const ids = new Set<string>();
  for (const g of guides) for (const s of pick(g)) for (const id of stepTickIds(g, s)) ids.add(id);
  let done = 0;
  for (const id of ids) if (checks[id]) done++;
  return { done, total: ids.size };
}

/** Progress of a chapter across the switched-on guides. */
export const chapterProgressOfGuides = (
  guides: Guide[],
  chapterId: string,
  checks: Record<string, true>,
) => unionProgress(guides, (g) => stepsInChapter(g, chapterId).map((x) => x.step), checks);

/** First main chapter that isn't finished in the switched-on guides (the first chapter when no guide is on). */
export function firstIncompleteChapter(guides: Guide[], checks: Record<string, true>): string {
  for (const c of MAIN_CHAPTERS) {
    const p = chapterProgressOfGuides(guides, c.id, checks);
    if (p.total > 0 && p.done < p.total) return c.id;
  }
  return guides.length ? MAIN_CHAPTERS[MAIN_CHAPTERS.length - 1].id : MAIN_CHAPTERS[0].id;
}

/** Missable collectables referenced by the switched-on guides that are still open, up to a chapter number. */
export function openMissable(
  guides: Guide[],
  checks: Record<string, true>,
  upToChapterNumber: number,
) {
  const seen = new Set<string>();
  const out: typeof checklist = [];
  for (const g of guides)
    for (const s of g.steps)
      for (const e of s.entries) {
        if (e.kind !== "item" || seen.has(e.ref)) continue;
        seen.add(e.ref);
        const item = checklist.find((i) => i.id === e.ref);
        if (!item?.missable || checks[item.id]) continue;
        if ((chapterNumber(item.chapterId) ?? 99) <= upToChapterNumber) out.push(item);
      }
  return out;
}

/** A chapter filter chip: a collectable category, or the section medals and prizes. */
export type ChapterCategory = ChecklistItem["category"] | "medal";

/**
 * Per-category progress of a chapter across the switched-on guides, in data order. Only collectables
 * and medals count; text and step ticks belong to no category.
 */
export function chapterCategoryProgress(
  guides: Guide[],
  chapterId: string,
  checks: Record<string, true>,
): { category: ChapterCategory; done: number; total: number }[] {
  const ids = new Set<string>();
  for (const g of guides)
    for (const { step } of stepsInChapter(g, chapterId))
      for (const id of stepTickIds(g, step)) ids.add(id);
  const counts = new Map<ChapterCategory, { done: number; total: number }>();
  for (const id of ids) {
    const category: ChapterCategory | undefined =
      checklistById.get(id)?.category ?? (medalIds.has(id) ? "medal" : undefined);
    if (!category) continue;
    const c = counts.get(category) ?? { done: 0, total: 0 };
    c.total++;
    if (checks[id]) c.done++;
    counts.set(category, c);
  }
  return [...checklistCategory.options, "medal" as const]
    .filter((category) => counts.has(category))
    .map((category) => ({ category, ...counts.get(category)! }));
}
