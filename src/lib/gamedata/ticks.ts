/**
 * Tick ids: how a profile records that something is done. `<kind>:<database id>`, so they stay
 * stable as long as the database ids do. Guide steps and text entries use `g:…` (see guide/types).
 */
export const tick = {
  photo: (id: string) => `photo:${id}`,
  invention: (id: string) => `invention:${id}`,
  pickup: (id: number) => `pickup:${id}`,
  recruit: (npcId: string) => `recruit:${npcId}`,
  georamaGoal: (id: number) => `georama-goal:${id}`,
  georamaTask: (id: number) => `georama-task:${id}`,
  badge: (classId: string) => `badge:${classId}`,
  /** A monster class evolved into a final form. */
  mastered: (classId: string) => `mastered:${classId}`,
  medal: (sectionId: string, kind: "time-attack" | "clear-goal" | "fishing" | "spheda") =>
    `medal:${sectionId}:${kind}`,
  ridepodPart: (id: string) => `part:${id}`,
  ridepodCore: (id: string) => `core:${id}`,
  /** Owning a weapon (the Spheda clubs). */
  weapon: (id: string) => `weapon:${id}`,
} as const;
