// Profile/state schema for the unified guide model (state version 3) and the migrations from older versions.
// Version 1 lives in profiles-v1.ts and is only read for migration. Version 2 has the same shape as
// version 3 but uses the ids from before game data came from drizzle/game.db (see gamedata/legacy.ts).
import { z } from "zod";
import {
  appState as appStateV1,
  exportFile as exportFileV1,
  type AppState as AppStateV1,
  type Profile as ProfileV1,
} from "./profiles-v1";
import { fromLegacyGuide, fromLegacyWalkthrough, migrateTickId } from "./guide/legacy";
import { MAIN_GUIDE_ID } from "./guide/main";
import { buildStart, guide, type Guide } from "./guide/types";
import { abilityId, stats } from "@/lib/schemas";
import { migrateChapterKey, migrateChecks, migrateGuide } from "./gamedata/legacy";

export const STORAGE_KEY = "dcc:state";
export const STATE_VERSION = 3;

export const dashboardView = z.enum(["chapter", "overview", "byGuide"]);
export type DashboardView = z.infer<typeof dashboardView>;

export const viewSettings = z.object({
  hideDone: z.boolean(),
  hidePostgame: z.boolean(),
  /** Show section facts (enemies, totals, medals) inside steps. */
  showFacts: z.boolean(),
  /** Planning and build steps only use items that can be bought; found-only items are flagged. */
  buyableOnly: z.boolean().default(true),
});

/** The planner's last inputs, remembered per profile (current shape). */
const plannerInputsData = z.object({
  targetId: z.string(),
  objective: z.enum(["abs", "gilda", "steps"]),
  maxChapter: z.number().int().min(1).max(8),
  budget: z.string(),
  abilities: z.array(abilityId),
  /** Where the abilities come from: side weapons' spheres first, or whichever is cheaper (see the planner's AbilitySource). */
  abilitySource: z.enum(["spheres", "cheapest"]).default("spheres"),
  /** Whether the start weapon is chosen by the planner (the line's first weapon) or set by hand. */
  customStart: z.boolean().default(false),
  /** Minimum stats and level required for the finished weapon; the UI prefills the target's max stats. */
  endStats: stats.default({ at: 0, fl: 0, ch: 0, li: 0, cy: 0, sm: 0, ex: 0, be: 0, sc: 0 }),
  endLevel: z.number().int().min(0).max(99).default(0),
  /** Start weapon and specs (also holds the support-character bonus). */
  start: buildStart.omit({ acquire: true }),
});

/** Planner inputs as stored today; inputs saved by older versions (startMode/goal/endMode fields) still load. */
export const plannerInputs = z.preprocess((v) => {
  if (v && typeof v === "object" && !("customStart" in v)) {
    const old = v as Record<string, unknown>;
    return { ...old, customStart: old.startMode === "custom" };
  }
  return v;
}, plannerInputsData);
export type PlannerInputs = z.infer<typeof plannerInputsData>;

/** One thing the player wants to make; the shopping list is derived from these (see `src/lib/shopping.ts`). */
export const shoppingGoal = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.enum(["item", "invention", "georama"]),
    name: z.string(),
    qty: z.number().int().min(1),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("build"),
    /** Build goals follow their guide: steps are resolved from the guide every time. */
    guideId: z.string(),
    stepIds: z.array(z.string()).min(1),
  }),
]);
export type ShoppingGoal = z.infer<typeof shoppingGoal>;

/** One shopping list per profile (shaped so it can later move into a `lists[]` array). */
export const shopping = z.object({
  goals: z.array(shoppingGoal),
  /** Items already carried, per item name; shared by every goal. */
  have: z.record(z.string(), z.number().int().min(0)),
  /** Components that are inventions themselves and should be invented instead of bought. */
  invent: z.array(z.string()),
  group: z.enum(["stops", "az"]),
});
export type Shopping = z.infer<typeof shopping>;
export const emptyShopping = (): Shopping => ({ goals: [], have: {}, invent: [], group: "stops" });

export const profile = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.number(),
  /** Ticks: data item ids, medal ids, and `g:<guide>:<step>[:<entry>]` for steps and text entries. */
  checks: z.record(z.string(), z.literal(true)),
  view: viewSettings,
  /** Guides switched on (built-in ids and the ids of the user's own guides). */
  activeGuides: z.array(z.string()),
  /** The user's own guides, including hand-made, pinned and imported ones. */
  guides: z.array(guide),
  planner: plannerInputs.optional(),
  dashboard: z.object({
    view: dashboardView,
    /** Chapter shown by the dashboard's chapter view ("1"…"8"); null follows progress. */
    currentChapter: z.string().nullable(),
  }),
  /** Added after version 2 shipped; older profiles get an empty list. */
  shopping: shopping.default(emptyShopping),
});
export type Profile = z.infer<typeof profile>;

export const appState = z.object({
  version: z.literal(STATE_VERSION),
  activeProfile: z.string(),
  profiles: z.record(z.string(), profile),
});
export type AppState = z.infer<typeof appState>;

/** State version 2: same shape, old ids. */
const appStateV2 = appState.extend({ version: z.literal(2) });
type AppStateV2 = z.infer<typeof appStateV2>;

/** Version 2 → 3: ticks, guide references and chapter keys move to the game-data ids. */
export function migrateProfileV2(p: Profile): Profile {
  return {
    ...p,
    checks: migrateChecks(p.checks),
    guides: p.guides.map(migrateGuide),
    dashboard: {
      ...p.dashboard,
      currentChapter: p.dashboard.currentChapter && migrateChapterKey(p.dashboard.currentChapter),
    },
  };
}

const migrateStateV2 = (s: Pick<AppStateV2, "activeProfile" | "profiles">): AppState => ({
  version: STATE_VERSION,
  activeProfile: s.activeProfile,
  profiles: Object.fromEntries(
    Object.entries(s.profiles).map(([id, p]) => [id, migrateProfileV2(p)]),
  ),
});

export function migrateProfile(p: ProfileV1): Profile {
  const guides: Guide[] = [
    ...p.customGuides.map((g) => fromLegacyGuide(g)),
    ...p.walkthroughs.map(fromLegacyWalkthrough),
  ];
  const checks = Object.fromEntries(
    Object.keys(p.checks).map((k) => [migrateTickId(k), true as const]),
  );
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    checks,
    view: {
      hideDone: p.view.hideDone,
      hidePostgame: p.view.hidePostgame,
      showFacts: p.view.layers.facts,
      buyableOnly: true,
    },
    // The main walkthrough is on by default, including for migrated profiles.
    activeGuides: [...new Set([MAIN_GUIDE_ID, ...p.activeGuides])],
    guides,
    dashboard: { view: "chapter", currentChapter: null },
    shopping: emptyShopping(),
  };
}

/** Version 1 → 3 (through version 2). */
export function migrateState(s: AppStateV1): AppState {
  return migrateStateV2({
    activeProfile: s.activeProfile,
    profiles: Object.fromEntries(
      Object.entries(s.profiles).map(([id, p]) => [id, migrateProfile(p)]),
    ),
  });
}

export function createProfile(name: string, now = Date.now()): Profile {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `p${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    checks: {},
    view: { hideDone: false, hidePostgame: false, showFacts: true, buyableOnly: true },
    activeGuides: [MAIN_GUIDE_ID],
    guides: [],
    dashboard: { view: "chapter", currentChapter: null },
    shopping: emptyShopping(),
  };
}

/** Reads persisted JSON of either version; falls back to a fresh state. */
/** Why stored data could not be used as is. */
export type LoadProblem = "corrupt" | "newer";

export interface LoadResult {
  state: AppState;
  /** Set when the stored data was not used; the caller must not lose it. */
  problem?: LoadProblem;
}

/** The active profile must exist; fall back to the first profile instead of discarding everything. */
function withActiveProfile(s: AppState): AppState | null {
  if (s.profiles[s.activeProfile]) return s;
  const first = Object.keys(s.profiles)[0];
  return first ? { ...s, activeProfile: first } : null;
}

/**
 * Reads stored state. Unreadable data and data from a newer version of the app come back as a fresh
 * state plus a `problem`, so the caller can keep the original (back it up, or not write over it).
 */
export function loadState(raw: string | null): LoadResult {
  const fresh = () => initialState();
  if (!raw) return { state: fresh() };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: fresh(), problem: "corrupt" };
  }
  const version =
    data && typeof data === "object" && "version" in data
      ? (data as { version: unknown }).version
      : undefined;
  if (typeof version === "number" && version > STATE_VERSION)
    return { state: fresh(), problem: "newer" };
  const v3 = appState.safeParse(data);
  if (v3.success) {
    const s = withActiveProfile(v3.data);
    return s ? { state: s } : { state: fresh() };
  }
  const v2 = appStateV2.safeParse(data);
  if (v2.success) {
    const s = withActiveProfile(migrateStateV2(v2.data));
    return s ? { state: s } : { state: fresh() };
  }
  const v1 = appStateV1.safeParse(data);
  if (v1.success && Object.keys(v1.data.profiles).length > 0) {
    const migrated = withActiveProfile(migrateState(v1.data));
    if (migrated) return { state: migrated };
  }
  return { state: fresh(), problem: "corrupt" };
}

/** Stored state, or a fresh one when it can't be used (see `loadState` for the reason). */
export const parseState = (raw: string | null): AppState => loadState(raw).state;

export type ViewSettings = z.infer<typeof viewSettings>;

export const initialState = (): AppState => {
  const p = createProfile("Playthrough 1");
  return { version: STATE_VERSION, activeProfile: p.id, profiles: { [p.id]: p } };
};

/** Export file wrapper (profiles including their progress). */
export const exportFile = z.object({
  app: z.literal("dark-chronicles-companion"),
  version: z.literal(STATE_VERSION),
  profiles: z.array(profile).min(1),
});
export type ExportFile = z.infer<typeof exportFile>;

/** Reads a profile export of any version; older files are migrated. */
export function parseProfileExport(data: unknown): ExportFile | null {
  const v3 = exportFile.safeParse(data);
  if (v3.success) return v3.data;
  const v2 = exportFile.extend({ version: z.literal(2) }).safeParse(data);
  if (v2.success)
    return { ...v2.data, version: STATE_VERSION, profiles: v2.data.profiles.map(migrateProfileV2) };
  const v1 = exportFileV1.safeParse(data);
  if (v1.success) {
    return {
      app: "dark-chronicles-companion",
      version: STATE_VERSION,
      profiles: v1.data.profiles.map((p) => migrateProfileV2(migrateProfile(p))),
    };
  }
  return null;
}

/** Merge imported profiles into state. Same-id profiles are replaced; others added. */
export function importProfiles(state: AppState, file: ExportFile): AppState {
  const profiles = { ...state.profiles };
  for (const p of file.profiles) profiles[p.id] = p;
  return { ...state, profiles, activeProfile: file.profiles[0].id };
}

/** Adds the file's profiles next to the existing ones (new ids), never replacing anything. */
export function importProfilesAsCopies(
  state: AppState,
  file: ExportFile,
  makeId: () => string,
  copyName: (name: string) => string,
): AppState {
  const profiles = { ...state.profiles };
  let first: string | undefined;
  for (const p of file.profiles) {
    const clash = !!profiles[p.id];
    const id = clash ? makeId() : p.id;
    profiles[id] = { ...p, id, name: clash ? copyName(p.name) : p.name };
    first ??= id;
  }
  return { ...state, profiles, activeProfile: first ?? state.activeProfile };
}
