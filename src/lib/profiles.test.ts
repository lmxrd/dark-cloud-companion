import { describe, expect, test } from "vitest";
import { weaponGuides } from "@/lib/guide/builtin";
import {
  createProfile as createProfileV1,
  initialState as initialStateV1,
} from "@/lib/profiles-v1";
import { planToGuide } from "@/lib/guides/fromPlan";
import { planPath } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import { freshState } from "@/lib/weapons/mechanics";
import { emptyWalkthrough } from "@/lib/walkthroughs/types";
import { deriveBuild } from "@/lib/guide/derive";
import {
  appState,
  createProfile,
  importProfiles,
  importProfilesAsCopies,
  loadState,
  migrateProfile,
  parseState,
} from "./profiles";

async function legacyProfile() {
  const p = createProfileV1("Old", 5);
  const result = await planPath({
    start: freshState(getWeapon("battle-wrench")),
    targetId: "drill-wrench",
    objective: "abs",
    goal: { kind: "reach" },
    maxChapter: 2,
    spBonus: 1,
  });
  const g = planToGuide({ id: "custom-a", title: "Mine", kind: "custom", summary: "s", result });
  const w = emptyWalkthrough("Route", 10);
  w.steps = [
    { id: "s1", chapterId: "c1", title: "T", notes: "", checklist: [{ id: "i1", text: "Clock" }] },
  ];
  return {
    ...p,
    customGuides: [g],
    walkthroughs: [w],
    activeGuides: ["custom-a", w.id, weaponGuides[0].id],
    checks: {
      "c1-scoop-brave-little-linda": true as const,
      "guide:custom-a:s1": true as const,
      [`wt:${w.id}:s1`]: true as const,
      [`wt:${w.id}:s1:i1`]: true as const,
    },
    view: { ...p.view, hideDone: true },
  };
}

describe("profile migration v1 -> v2", () => {
  test("merges custom guides and walkthroughs into guides and rewrites ticks", async () => {
    const old = await legacyProfile();
    const next = migrateProfile(old);
    expect(next.guides.map((g) => g.id)).toEqual(["custom-a", old.walkthroughs[0].id]);
    expect(Object.keys(next.checks).sort()).toEqual(
      [
        "c1-scoop-brave-little-linda",
        "g:custom-a:s1",
        `g:${old.walkthroughs[0].id}:s1`,
        `g:${old.walkthroughs[0].id}:s1:i1`,
      ].sort(),
    );
    expect(next.view).toEqual({
      hideDone: true,
      hidePostgame: false,
      showFacts: true,
      buyableOnly: true,
    });
    // Main walkthrough on by default, existing toggles kept.
    expect(next.activeGuides[0]).toBe("main");
    expect(next.activeGuides).toContain("custom-a");
    expect(next.dashboard).toEqual({ view: "chapter", currentChapter: null });
  }, 60000);

  test("the migrated build guide still derives without errors", async () => {
    const next = migrateProfile(await legacyProfile());
    const g = next.guides.find((x) => x.id === "custom-a")!;
    expect(deriveBuild(g).errors).toEqual([]);
  }, 60000);

  test("a full v1 state parses into a valid v2 state; a v2 state round-trips; garbage resets", async () => {
    const v1 = initialStateV1();
    const migrated = parseState(JSON.stringify(v1));
    expect(appState.safeParse(migrated).success).toBe(true);
    expect(migrated.profiles[migrated.activeProfile].activeGuides).toContain("main");
    expect(parseState(JSON.stringify(migrated))).toEqual(migrated);
    expect(Object.keys(parseState("nope").profiles)).toHaveLength(1);
  });
});

describe("buyable-only setting", () => {
  test("defaults to on for new, migrated and older v2 profiles", () => {
    expect(createProfile("x").view.buyableOnly).toBe(true);
    const old = createProfile("old");
    // A v2 state saved before the setting existed has no such key.
    const { buyableOnly: _drop, ...view } = old.view;
    const state = { version: 2, activeProfile: old.id, profiles: { [old.id]: { ...old, view } } };
    expect(parseState(JSON.stringify(state)).profiles[old.id].view.buyableOnly).toBe(true);
  });
});

describe("planner inputs", () => {
  test("are optional, validated and round-trip through state", async () => {
    const p = createProfile("p");
    expect(p.planner).toBeUndefined();
    const { stateToBuildStart } = await import("@/lib/guide/fromPlan");
    const { acquire: _a, ...start } = stateToBuildStart(freshState(getWeapon("battle-wrench")), 1);
    const withInputs = {
      ...p,
      planner: {
        targetId: "grade-zero",
        objective: "abs" as const,
        maxChapter: 7,
        budget: "15000",
        abilities: ["poison" as const],
        customStart: false,
        endLevel: 0,
        start,
      },
    };
    const state = { version: 2, activeProfile: p.id, profiles: { [p.id]: withInputs } };
    const planner = parseState(JSON.stringify(state)).profiles[p.id].planner;
    expect(planner?.targetId).toBe("grade-zero");
    expect(planner?.customStart).toBe(false);
    // Inputs remembered by an older version (startMode/goal/endMode) still load.
    const legacy = parseState(
      JSON.stringify({
        ...state,
        profiles: {
          [p.id]: {
            ...withInputs,
            planner: {
              targetId: "grade-zero",
              baseGuideId: "",
              objective: "abs",
              goal: "max",
              maxChapter: 7,
              budget: "",
              abilities: [],
              startMode: "custom",
              endMode: "existing",
              start,
            },
          },
        },
      }),
    ).profiles[p.id].planner;
    expect(legacy?.customStart).toBe(true);
    // Inputs saved before the ability source existed take side-weapon spheres.
    expect(legacy?.abilitySource).toBe("spheres");
    // Invalid inputs make the whole state fall back rather than corrupt the planner.
    const bad = {
      ...state,
      profiles: { [p.id]: { ...withInputs, planner: { ...withInputs.planner, maxChapter: 99 } } },
    };
    expect(parseState(JSON.stringify(bad)).profiles[p.id]?.planner).toBeUndefined();
  });
});

describe("loadState", () => {
  const valid = () => {
    const p = createProfile("Alpha");
    return { version: 3, activeProfile: p.id, profiles: { [p.id]: p } };
  };

  test("nothing stored is a fresh state without a problem", () => {
    expect(loadState(null).problem).toBeUndefined();
  });

  test("valid state loads as is", () => {
    const s = valid();
    expect(loadState(JSON.stringify(s))).toEqual({ state: s });
  });

  test("corrupt JSON and unknown shapes are reported, not silently replaced", () => {
    expect(loadState("{ nope").problem).toBe("corrupt");
    expect(loadState(JSON.stringify({ version: 2, profiles: "x" })).problem).toBe("corrupt");
  });

  test("data from a newer version is reported so it is never overwritten", () => {
    const r = loadState(JSON.stringify({ ...valid(), version: 99 }));
    expect(r.problem).toBe("newer");
  });

  test("a missing active profile is repaired instead of discarding everything", () => {
    const s = valid();
    const r = loadState(JSON.stringify({ ...s, activeProfile: "gone" }));
    expect(r.problem).toBeUndefined();
    expect(r.state.activeProfile).toBe(Object.keys(s.profiles)[0]);
    expect(r.state.profiles).toEqual(s.profiles);
  });
});

describe("profile import", () => {
  const state = () => {
    const p = createProfile("Alpha");
    return { version: 3 as const, activeProfile: p.id, profiles: { [p.id]: p } };
  };

  test("replace overwrites the profile with the same id", () => {
    const s = state();
    const mine = s.profiles[s.activeProfile];
    const fromFile = { ...mine, name: "Older backup", checks: {} };
    const next = importProfiles(s, {
      app: "dark-chronicles-companion",
      version: 3,
      profiles: [fromFile],
    });
    expect(Object.keys(next.profiles)).toHaveLength(1);
    expect(next.profiles[mine.id].name).toBe("Older backup");
  });

  test("copies keep the existing profile and add the file's under a new id", () => {
    const s = state();
    const mine = { ...s.profiles[s.activeProfile], checks: { a: true as const } };
    s.profiles[mine.id] = mine;
    const fromFile = { ...mine, checks: {} };
    const next = importProfilesAsCopies(
      s,
      { app: "dark-chronicles-companion", version: 3, profiles: [fromFile] },
      () => "new-id",
      (n) => `${n} (imported)`,
    );
    expect(next.profiles[mine.id].checks).toEqual({ a: true });
    expect(next.profiles["new-id"]).toMatchObject({ name: "Alpha (imported)", checks: {} });
    expect(next.activeProfile).toBe("new-id");
  });
});

describe("profile migration v2 -> v3 (game-data ids)", () => {
  const v2 = () => {
    const p = createProfile("Old ids", 7);
    p.checks = {
      "c1-scoop-brave-little-linda": true,
      "c1-rats:timeAttack": true,
      "c2-recruit-parn-julia": true,
      "c1-powerup-fruit-of-eden": true,
      "ridepod:cannonball-arm": true,
      "monster:beast:badge": true,
      "g:custom:s1:t1": true,
      "something-unknown": true,
    };
    p.dashboard.currentChapter = "c3";
    p.guides = [
      {
        id: "custom",
        title: "Mine",
        kind: "custom",
        steps: [
          {
            id: "s1",
            title: "Step",
            notes: "",
            chapterId: "c1",
            sectionId: "c1-rats",
            entries: [
              { kind: "text", id: "t1", text: "Clock" },
              { kind: "item", ref: "c2-recruit-parn-julia" },
              { kind: "section", ref: "c1-rats" },
            ],
          },
        ],
      },
    ];
    return { version: 2, activeProfile: p.id, profiles: { [p.id]: p } };
  };

  test("ticks, guide references and chapter keys move to the new ids; unknown ticks stay", () => {
    const { state, problem } = loadState(JSON.stringify(v2()));
    expect(problem).toBeUndefined();
    expect(state.version).toBe(3);
    const p = Object.values(state.profiles)[0];
    expect(Object.keys(p.checks).sort()).toEqual(
      [
        "photo:brave-little-linda",
        "medal:battle-with-rats:time-attack",
        "recruit:parn",
        "recruit:julia",
        "pickup:1",
        "part:cannonball-arm",
        "badge:beast",
        "g:custom:s1:t1",
        "something-unknown",
      ].sort(),
    );
    expect(p.dashboard.currentChapter).toBe("3");
    const step = p.guides[0].steps[0];
    expect(step.chapterId).toBe("1");
    expect(step.sectionId).toBe("battle-with-rats");
    expect(step.entries).toEqual([
      { kind: "text", id: "t1", text: "Clock" },
      { kind: "item", ref: "recruit:parn" },
      { kind: "item", ref: "recruit:julia" },
      { kind: "section", ref: "battle-with-rats" },
    ]);
  });

  test("migrating twice changes nothing", () => {
    const once = loadState(JSON.stringify(v2())).state;
    expect(loadState(JSON.stringify(once)).state).toEqual(once);
  });
});

describe("shopping list state", () => {
  test("older v2 profiles without a shopping list load with an empty one", () => {
    const p = createProfile("Old v2");
    const { shopping: _drop, ...older } = p;
    const raw = JSON.stringify({ version: 2, activeProfile: p.id, profiles: { [p.id]: older } });
    expect(parseState(raw).profiles[p.id].shopping).toEqual({
      goals: [],
      have: {},
      invent: [],
      group: "stops",
    });
  });

  test("new and migrated profiles start empty; goals round-trip", async () => {
    expect(createProfile("New").shopping.goals).toEqual([]);
    expect(migrateProfile(await legacyProfile()).shopping.goals).toEqual([]);
    const p = createProfile("Shopper");
    p.shopping = {
      goals: [
        { id: "a", kind: "georama", name: "River", qty: 15 },
        { id: "b", kind: "build", guideId: "x", stepIds: ["s1"] },
      ],
      have: { "Water Element": 3 },
      invent: ["Bomb"],
      group: "az",
    };
    const state = { version: 3 as const, activeProfile: p.id, profiles: { [p.id]: p } };
    expect(appState.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
    // A broken goal makes the state fall back instead of reaching the UI.
    const bad = JSON.stringify({
      ...state,
      profiles: {
        [p.id]: {
          ...p,
          shopping: { ...p.shopping, goals: [{ id: "c", kind: "item", name: "X", qty: 0 }] },
        },
      },
    });
    expect(parseState(bad).profiles[p.id]).toBeUndefined();
  });
});
