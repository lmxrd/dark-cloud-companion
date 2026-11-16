// Version 1 → 3 migration (separate guides and walkthroughs into unified guides), loaded only when
// version 1 data turns up (see `loadV1Migration` in profiles.ts).
import { fromLegacyGuide, fromLegacyWalkthrough, migrateTickId } from "./guide/legacy";
import { MAIN_GUIDE_ID, type Guide } from "./guide/types";
import {
  emptyShopping,
  migrateStateV2,
  type AppState,
  type Profile,
  type V1Migration,
} from "./profiles";
import type { AppState as AppStateV1, Profile as ProfileV1 } from "./profiles-v1";

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

export const v1Migration: V1Migration = { state: migrateState, profile: migrateProfile };
