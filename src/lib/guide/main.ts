// The built-in main walkthrough, generated from the game data (no source prose): per chapter an overview step
// with the items not tied to a section, then one step per section with its facts/medals and the items found there.
import {
  chapters,
  itemsOf,
  sectionsOf,
  type ChecklistCategory,
  type ChecklistItem,
} from "@/lib/data";
import type { Entry, Guide, Step } from "./types";

export const MAIN_GUIDE_ID = "main";

const categoryOrder: ChecklistCategory[] = [
  "scoop",
  "idea",
  "invention",
  "powerup",
  "recruit",
  "georama",
  "badge",
];

function itemEntries(items: ChecklistItem[]): Entry[] {
  return [...items]
    .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category))
    .map((i) => ({ kind: "item" as const, ref: i.id }));
}

export function buildMainWalkthrough(): Guide {
  const steps: Step[] = [];
  for (const chapter of chapters) {
    const items = itemsOf(chapter.id);
    const here = new Set(sectionsOf(chapter.id).map((s) => s.id));
    // Items placed in a section of another chapter (available "after" it) are listed loose.
    const loose = items.filter((i) => !i.sectionId || !here.has(i.sectionId));
    if (loose.length) {
      steps.push({
        id: `ch-${chapter.id}`,
        title: `${chapter.number}. ${chapter.title}`,
        notes: "",
        chapterId: chapter.id,
        entries: itemEntries(loose),
      });
    }
    for (const section of sectionsOf(chapter.id)) {
      const here = items.filter((i) => i.sectionId === section.id);
      const hasFacts = !!section.medals || section.kind === "dungeon" || section.kind === "boss";
      const entries: Entry[] = [
        ...(hasFacts ? [{ kind: "section" as const, ref: section.id }] : []),
        ...itemEntries(here),
      ];
      if (!entries.length) continue;
      steps.push({
        id: `sec-${section.id}`,
        title: section.title,
        notes: "",
        chapterId: chapter.id,
        sectionId: section.id,
        entries,
      });
    }
  }
  return { id: MAIN_GUIDE_ID, title: "Main walkthrough", kind: "builtin", steps };
}

export const mainWalkthrough = buildMainWalkthrough();
