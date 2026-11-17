import { describe, expect, test } from "vitest";
import { getWeapon } from "@/lib/planner/sources";
import { freshState } from "@/lib/weapons/mechanics";
import {
  appState,
  createProfile,
  importProfiles,
  importProfilesAsCopies,
  loadState,
  parseState,
} from "./profiles";

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
        itemPool: "cheap" as const,
        solveTime: "quick" as const,
        story: false,
        abilitySource: "spheres" as const,
        customStart: false,
        endStats: { at: 0, fl: 0, ch: 0, li: 0, cy: 0, sm: 0, ex: 0, be: 0, sc: 0 },
        endLevel: 0,
        start,
      },
    };
    const state = { version: 3, activeProfile: p.id, profiles: { [p.id]: withInputs } };
    const planner = parseState(JSON.stringify(state)).profiles[p.id].planner;
    expect(planner?.targetId).toBe("grade-zero");
    expect(planner?.customStart).toBe(false);
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

  test("one unreadable profile costs only itself; the rest load and the problem is reported", () => {
    const s = valid();
    const ok = Object.values(s.profiles)[0];
    const bad = { ...createProfile("Broken"), checks: "nope" };
    const r = loadState(
      JSON.stringify({ ...s, activeProfile: bad.id, profiles: { ...s.profiles, [bad.id]: bad } }),
    );
    expect(r.problem).toBe("partial");
    expect(Object.keys(r.state.profiles)).toEqual([ok.id]);
    expect(r.state.activeProfile).toBe(ok.id);
  });

  test("remembered planner inputs that don't parse are dropped, the profile is kept", () => {
    const s = valid();
    const p = Object.values(s.profiles)[0];
    const r = loadState(
      JSON.stringify({ ...s, profiles: { [p.id]: { ...p, planner: { endStats: { fl: -5 } } } } }),
    );
    expect(r.problem).toBeUndefined();
    expect(r.state.profiles[p.id].planner).toBeUndefined();
  });

  test("data from an older version is unreadable (kept as a backup by the store)", () => {
    const s = valid();
    expect(loadState(JSON.stringify({ ...s, version: 2 })).problem).toBe("corrupt");
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

describe("shopping list state", () => {
  test("new profiles start empty; goals round-trip", () => {
    expect(createProfile("New").shopping.goals).toEqual([]);
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
