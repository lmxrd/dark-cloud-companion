import { atom, computed } from "nanostores";
import { mergeGuides, type ContentFile, type MergeSummary } from "./content-file";
import type { Guide } from "./guide/types";
import {
  STATE_VERSION,
  STORAGE_KEY,
  createProfile,
  importProfiles,
  importProfilesAsCopies,
  initialState,
  parseProfileExport,
  loadState,
  type AppState,
  type ExportFile,
  type PlannerInputs,
  type Profile,
  type ViewSettings,
} from "./profiles";

/**
 * The state every island renders on the server and during hydration: a fresh default profile. The
 * client swaps in the stored state right after hydrating (see `useAppState` and friends), so the first
 * client render always matches the server HTML.
 */
export const SERVER_STATE: AppState = initialState();

export const $state = atom<AppState>(SERVER_STATE);
/** False until localStorage has been read on the client (avoid hydration flashes). */
export const $ready = atom(false);

export const $profile = computed($state, (s) => s.profiles[s.activeProfile]);
export const $checks = computed($profile, (p) => p.checks);

/** Something is wrong with what is stored in this browser; the app shows a banner for it. */
export type StorageProblem =
  | { kind: "corrupt"; backupKey: string | null }
  | { kind: "newer" }
  | { kind: "save-failed" };
export const $storageProblem = atom<StorageProblem | null>(null);

/** False when the stored data is from a newer version of the app: never write over it. */
let writable = true;

function persist(s: AppState) {
  if (!writable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    if ($storageProblem.get()?.kind === "save-failed") $storageProblem.set(null);
  } catch {
    // Storage full, or blocked (private browsing): every later change would be lost on reload.
    $storageProblem.set({ kind: "save-failed" });
  }
}

/** Keeps a copy of stored data the app can't read, so a fallback never destroys it. */
function backUp(raw: string): string | null {
  const key = `${STORAGE_KEY}:backup-${Date.now()}`;
  try {
    localStorage.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {}
  const loaded = loadState(raw);
  if (loaded.problem === "newer") {
    writable = false;
    $storageProblem.set({ kind: "newer" });
  } else if (loaded.problem === "corrupt" && raw) {
    $storageProblem.set({ kind: "corrupt", backupKey: backUp(raw) });
  }
  $state.set(loaded.state);
  $ready.set(true);
  $state.listen(persist);
  // Keep tabs in sync, but only with data this version can read: a cleared key, a newer format or
  // garbage from another tab must not replace (and then overwrite) this tab's state.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || e.newValue === null) return;
    const next = loadState(e.newValue);
    if (next.problem === "newer") {
      writable = false;
      $storageProblem.set({ kind: "newer" });
      return;
    }
    if (!next.problem) $state.set(next.state);
  });
}

/** The raw text of a backup made by `backUp`, for downloading. */
export function readBackup(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function dismissStorageProblem() {
  $storageProblem.set(null);
}

function updateProfile(fn: (p: Profile) => Profile) {
  const s = $state.get();
  const p = s.profiles[s.activeProfile];
  $state.set({ ...s, profiles: { ...s.profiles, [p.id]: fn(p) } });
}

export function setChecked(id: string, checked: boolean) {
  updateProfile((p) => {
    const checks = { ...p.checks };
    if (checked) checks[id] = true;
    else delete checks[id];
    return { ...p, checks };
  });
}

/** Sets several ticks at once (e.g. "complete this step"). */
export function setManyChecked(ids: string[], checked: boolean) {
  updateProfile((p) => {
    const checks = { ...p.checks };
    for (const id of ids) {
      if (checked) checks[id] = true;
      else delete checks[id];
    }
    return { ...p, checks };
  });
}

export function setView(patch: Partial<ViewSettings>) {
  updateProfile((p) => ({ ...p, view: { ...p.view, ...patch } }));
}

/** `null` follows progress automatically. */
export function setCurrentChapter(chapterId: string | null) {
  updateProfile((p) => ({ ...p, dashboard: { ...p.dashboard, currentChapter: chapterId } }));
}

/** Remembers the planner's inputs in the active profile. */
export function setPlannerInputs(inputs: PlannerInputs) {
  updateProfile((p) => ({ ...p, planner: inputs }));
}

/** Forgets the planner's remembered inputs (a way out if they ever cause trouble). */
export function clearPlannerInputs() {
  updateProfile((p) => {
    const { planner: _drop, ...rest } = p;
    return rest;
  });
}

export function toggleGuide(id: string, on: boolean) {
  updateProfile((p) => ({
    ...p,
    activeGuides: on
      ? [...new Set([...p.activeGuides, id])]
      : p.activeGuides.filter((g) => g !== id),
  }));
}

/** Creates or replaces one of the user's own guides. */
export function saveGuide(g: Guide, opts: { activate?: boolean } = {}) {
  updateProfile((p) => {
    const next: Guide = {
      ...g,
      kind: "custom",
      updatedAt: Date.now(),
      createdAt: g.createdAt ?? Date.now(),
    };
    const exists = p.guides.some((x) => x.id === g.id);
    return {
      ...p,
      guides: exists ? p.guides.map((x) => (x.id === g.id ? next : x)) : [...p.guides, next],
      activeGuides: opts.activate ? [...new Set([...p.activeGuides, g.id])] : p.activeGuides,
    };
  });
}

export function deleteGuide(id: string) {
  updateProfile((p) => ({
    ...p,
    guides: p.guides.filter((g) => g.id !== id),
    activeGuides: p.activeGuides.filter((g) => g !== id),
    // Drop this guide's own ticks so stale progress doesn't linger (shared data-item ticks stay).
    checks: Object.fromEntries(
      Object.entries(p.checks).filter(([k]) => !k.startsWith(`g:${id}:`)),
    ) as typeof p.checks,
  }));
}

/** Merges validated imported guides into the active profile; returns what happened. */
export function applyContent(file: ContentFile): MergeSummary {
  let summary: MergeSummary = { added: 0, copied: 0, skipped: 0 };
  updateProfile((p) => {
    const merged = mergeGuides(
      p.guides,
      file.guides as Guide[],
      (old) => `${old}-i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    );
    summary = merged.summary;
    return { ...p, guides: merged.guides };
  });
  return summary;
}

export function addProfile(name: string) {
  const p = createProfile(name);
  const s = $state.get();
  $state.set({ ...s, activeProfile: p.id, profiles: { ...s.profiles, [p.id]: p } });
}

export function switchProfile(id: string) {
  const s = $state.get();
  if (s.profiles[id]) $state.set({ ...s, activeProfile: id });
}

export function renameProfile(id: string, name: string) {
  const s = $state.get();
  if (!s.profiles[id] || !name.trim()) return;
  $state.set({ ...s, profiles: { ...s.profiles, [id]: { ...s.profiles[id], name: name.trim() } } });
}

export function deleteProfile(id: string) {
  const s = $state.get();
  const ids = Object.keys(s.profiles);
  if (ids.length <= 1 || !s.profiles[id]) return;
  const { [id]: _removed, ...rest } = s.profiles;
  $state.set({
    ...s,
    profiles: rest,
    activeProfile: s.activeProfile === id ? Object.keys(rest)[0] : s.activeProfile,
  });
}

export function buildExport(ids?: string[]): ExportFile {
  const s = $state.get();
  const profiles = (ids ?? Object.keys(s.profiles)).map((id) => s.profiles[id]).filter(Boolean);
  return { app: "dark-chronicles-companion", version: STATE_VERSION, profiles };
}

/** A checked profile export, and which existing profiles it would replace. */
export interface ProfileImport {
  file: ExportFile;
  /** Names of profiles here with the same id as one in the file. */
  replaces: string[];
}

/**
 * Reads and validates a profile export without changing anything. Returns an error message, or the
 * import to confirm. Accepts exports of the current and the previous format.
 */
export async function readProfileImport(json: string): Promise<string | ProfileImport> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return "Not valid JSON";
  }
  const parsed = parseProfileExport(data);
  if (!parsed) return "Not a Dark Chronicles Companion export";
  // Guides reference weapons, items and chapters: make sure they all exist before accepting.
  const { validateGuide } = await import("./content-validate");
  const errors = parsed.profiles.flatMap((p) =>
    p.guides.flatMap((g) => validateGuide(g).map((e) => `${p.name} / ${g.title}: ${e}`)),
  );
  if (errors.length) return errors.slice(0, 5).join("\n");
  const current = $state.get().profiles;
  return {
    file: parsed,
    replaces: parsed.profiles.flatMap((p) => (current[p.id] ? [current[p.id].name] : [])),
  };
}

/** Applies a read import: replace same-id profiles, or add everything as copies. */
export function applyProfileImport(
  imp: ProfileImport,
  mode: "replace" | "copy",
  copyName: (n: string) => string,
) {
  const s = $state.get();
  $state.set(
    mode === "replace"
      ? importProfiles(s, imp.file)
      : importProfilesAsCopies(s, imp.file, () => createProfile("").id, copyName),
  );
}
