// Chapters, sections and everything that can be ticked off, in the shapes the dashboard, guides and
// trackers use. Built from the game data exported from drizzle/game.db (`@/lib/gamedata`).
import { collectables, core, names, type Reward } from "@/lib/gamedata";
import { tick } from "@/lib/gamedata/ticks";

export const CHECKLIST_CATEGORIES = [
  "scoop",
  "idea",
  "invention",
  "powerup",
  "recruit",
  "georama",
  "badge",
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

/** A recipe ingredient: a photo, by id and name. */
export interface RecipePart {
  id: string;
  name: string;
  /** It is a scoop (a photo of something that happens), not an idea. */
  scoop: boolean;
}

/** Something to tick off; `id` is its tick id. */
export interface ChecklistItem {
  id: string;
  /** "1"…"8". */
  chapterId: string;
  category: ChecklistCategory;
  name: string;
  missable: boolean;
  /** Only available after the main ending (chapter 8). */
  postgame: boolean;
  /** Ghost scoop (photographed at night). */
  ghost?: boolean;
  /** Section where it is found or becomes available. */
  sectionId?: string;
  recipe?: RecipePart[];
  /** Where exactly, or what it takes. */
  notes?: string[];
  /** Georama goals that ask for a number of one part (for the shopping list). */
  georamaPart?: { name: string; qty: number };
}

export type SectionKind = "story" | "interlude" | "dungeon" | "boss";
export type ClearGoal = NonNullable<(typeof core.sections)[number]["medalClearGoal"]>;

export interface Section {
  id: string;
  /** "1"…"8". */
  chapterId: string;
  title: string;
  kind: SectionKind;
  position: number;
  dungeonId?: string;
  /** The seal on the floor ("white-seal", …). */
  restriction?: string;
  hasGeostone: boolean;
  optional: boolean;
  medals?: {
    timeAttackSeconds?: number;
    clearGoal?: ClearGoal;
    fishingCentimeters?: number;
    /** The first-win Spheda prize. */
    spheda?: Reward;
  };
}

export interface Chapter {
  /** "1"…"8"; also the URL segment (`/chapters/3`). */
  id: string;
  number: number;
  title: string;
  /** Chapter 8 opens after the main ending. */
  phase: "main" | "postgame";
  sectionIds: string[];
}

export const POSTGAME_CHAPTER = 8;
const chapterKey = (n: number) => String(n);

export const sections: Section[] = core.sections.map((s) => {
  const medals: Section["medals"] = {
    ...(s.medalTimeAttackSeconds ? { timeAttackSeconds: s.medalTimeAttackSeconds } : {}),
    ...(s.medalClearGoal ? { clearGoal: s.medalClearGoal } : {}),
    ...(s.medalFishingCentimeters ? { fishingCentimeters: s.medalFishingCentimeters } : {}),
    ...(s.sphedaPrize ? { spheda: s.sphedaPrize } : {}),
  };
  return {
    id: s.id,
    chapterId: chapterKey(s.chapterNumber),
    title: s.title,
    kind: s.type,
    position: s.position,
    ...(s.dungeonId ? { dungeonId: s.dungeonId } : {}),
    ...(s.restriction ? { restriction: s.restriction } : {}),
    hasGeostone: !!s.hasGeostone,
    optional: !!s.optional,
    ...(Object.keys(medals).length ? { medals } : {}),
  };
});

export const chapters: Chapter[] = core.chapters.map((c) => ({
  id: chapterKey(c.number),
  number: c.number,
  title: c.title,
  phase: c.number === POSTGAME_CHAPTER ? "postgame" : "main",
  sectionIds: sections.filter((s) => s.chapterId === chapterKey(c.number)).map((s) => s.id),
}));

// ---------- checklist ----------

const notesOf = (...parts: (string | string[] | undefined)[]) => {
  const list = parts.flat().filter((p): p is string => !!p);
  return list.length ? { notes: list } : {};
};
const placed = <T extends { sectionId?: string }>(r: T) =>
  r.sectionId ? { sectionId: r.sectionId } : {};

/** The chapter a georama town is built in: that of the dungeon entered from it. */
const townChapter = new Map<string, number>();
for (const d of core.dungeons) {
  const town = d.townId ?? d.id;
  if (!townChapter.has(town)) townChapter.set(town, d.chapterNumber);
}

const photoById = new Map(collectables.photos.map((p) => [p.id, p]));

const photoItems: ChecklistItem[] = collectables.photos.map((p) => ({
  id: tick.photo(p.id),
  chapterId: chapterKey(p.chapterNumber),
  category: p.type,
  name: p.name,
  missable: !!p.missable,
  postgame: p.chapterNumber === POSTGAME_CHAPTER,
  ...(p.ghost ? { ghost: true } : {}),
  ...placed(p),
  ...notesOf(p.townId && names.towns[p.townId], p.notes),
}));

const inventionItems: ChecklistItem[] = collectables.inventions.map((i) => ({
  id: tick.invention(i.id),
  chapterId: chapterKey(i.chapterNumber),
  category: "invention",
  name: i.name,
  missable: !!i.missable,
  postgame: i.chapterNumber === POSTGAME_CHAPTER,
  ...placed(i),
  recipe: (i.recipes[0] ?? []).map((id) => ({
    id,
    name: names.photos[id] ?? id,
    scoop: photoById.get(id)?.type === "scoop",
  })),
}));

const pickupItems: ChecklistItem[] = collectables.pickups.map((p) => ({
  id: tick.pickup(p.id),
  chapterId: chapterKey(p.chapterNumber),
  category: "powerup",
  name: (p.quantity > 1 ? `${p.quantity}× ` : "") + names.items[p.itemId],
  missable: !!p.missable,
  postgame: p.chapterNumber === POSTGAME_CHAPTER,
  ...(p.sectionId
    ? { sectionId: p.sectionId }
    : p.afterSectionId
      ? { sectionId: p.afterSectionId }
      : {}),
  ...notesOf(p.townId && names.towns[p.townId], p.notes),
}));

const recruitItems: ChecklistItem[] = collectables.recruits.map((r) => ({
  id: tick.recruit(r.npcId),
  chapterId: chapterKey(r.chapterNumber),
  category: "recruit",
  name: names.npcs[r.npcId],
  missable: !!r.missable,
  postgame: r.chapterNumber === POSTGAME_CHAPTER,
  ...placed(r),
  ...notesOf(r.location, r.notes),
}));

/** Georama: each goal is ticked, except "task done" goals (they follow from the other ticks); a
 * task without goals (Moon Flower Palace) is ticked itself. */
const georamaItems: ChecklistItem[] = collectables.georamaTasks.flatMap((task) => {
  const chapter = townChapter.get(task.townId) ?? 1;
  const base = {
    chapterId: chapterKey(chapter),
    category: "georama" as const,
    missable: false,
    postgame: chapter === POSTGAME_CHAPTER,
  };
  const goals = task.goals.filter((g) => g.type !== "task-completed");
  if (!goals.length)
    return [
      { ...base, id: tick.georamaTask(task.id), name: task.name, notes: [`${task.percent}%`] },
    ];
  return goals.map((g) => ({
    ...base,
    id: tick.georamaGoal(g.id),
    name: g.name,
    notes: [task.name],
    ...(g.georamaPartId && g.quantity
      ? { georamaPart: { name: names.georamaParts[g.georamaPartId], qty: g.quantity } }
      : {}),
  }));
});

const badgeItems: ChecklistItem[] = collectables.monsterClasses.map((c) => ({
  id: tick.badge(c.id),
  chapterId: chapterKey(c.chapterNumber),
  category: "badge",
  name: c.badgeName,
  missable: !!c.missable,
  postgame: c.chapterNumber === POSTGAME_CHAPTER,
  ...placed(c),
  ...notesOf(c.notes),
}));

export const checklist: ChecklistItem[] = [
  ...photoItems,
  ...inventionItems,
  ...pickupItems,
  ...recruitItems,
  ...georamaItems,
  ...badgeItems,
];

export const chapterById = new Map(chapters.map((c) => [c.id, c]));
export const sectionById = new Map(sections.map((s) => [s.id, s]));

export const sectionsOf = (chapterId: string) => sections.filter((s) => s.chapterId === chapterId);
export const itemsOf = (chapterId: string) => checklist.filter((i) => i.chapterId === chapterId);

// ---------- medals ----------

export const MEDAL_KINDS = ["time-attack", "clear-goal", "fishing", "spheda"] as const;
export type MedalKind = (typeof MEDAL_KINDS)[number];

export interface MedalItem {
  id: string;
  sectionId: string;
  kind: MedalKind;
  /** time-attack: "2:45"; fishing: "30 cm"; spheda: the prize; clear-goal: the goal key. */
  value: string;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export const rewardName = (r: Reward) => {
  const name =
    (r.itemId && names.items[r.itemId]) ||
    (r.weaponId && names.weapons[r.weaponId]) ||
    (r.ridepodPartId && names.ridepodParts[r.ridepodPartId]) ||
    (r.ridepodCoreId && names.ridepodCores[r.ridepodCoreId]) ||
    "?";
  return r.quantity > 1 ? `${name} ×${r.quantity}` : name;
};

/** A section's medals, derived from its data rather than stored as checklist items. */
export function medalItems(section: Section): MedalItem[] {
  const m = section.medals;
  if (!m) return [];
  const item = (kind: MedalKind, value: string): MedalItem => ({
    id: tick.medal(section.id, kind),
    sectionId: section.id,
    kind,
    value,
  });
  return [
    m.timeAttackSeconds !== undefined && item("time-attack", clock(m.timeAttackSeconds)),
    m.clearGoal && item("clear-goal", m.clearGoal),
    m.fishingCentimeters !== undefined && item("fishing", `${m.fishingCentimeters} cm`),
    m.spheda && item("spheda", rewardName(m.spheda)),
  ].filter((x): x is MedalItem => !!x);
}

export const allMedals = sections.flatMap(medalItems);

/** An invention is buildable once every photo of its recipe is ticked. */
export function inventionReady(item: ChecklistItem, checks: Record<string, true>): boolean {
  return (item.recipe ?? []).every((r) => !!checks[tick.photo(r.id)]);
}
