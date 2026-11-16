// Built-in guides: the generated main walkthrough plus the weapon build guides — all of the
// latter are predefined plans, generated at build time from scripts/planner/plans.config.ts
// into src/data/plans.json (see scripts/planner/predefined.ts and integrations/plans.ts).
import plansJson from "@/data/plans.json";
import { z } from "zod";
import { mainWalkthrough } from "./main";
import { guide, type Guide } from "./types";

const plans = z
  .object({ guides: z.array(guide), variants: z.record(z.string(), z.string()) })
  .parse(plansJson);
export const weaponGuides: Guide[] = plans.guides;
/** A built-in plan's variant from its config key ("balanced", "earliest", "gilda-max"). */
export const planVariant = (id: string): string | undefined => plans.variants[id];
export const builtinGuides: Guide[] = [mainWalkthrough, ...weaponGuides];
export const builtinGuideById = new Map(builtinGuides.map((g) => [g.id, g]));

/** Built-in guides followed by the profile's own guides. */
export const allGuides = (own: Guide[]): Guide[] => [...builtinGuides, ...own];

export function findGuide(id: string, own: Guide[]): Guide | undefined {
  return builtinGuideById.get(id) ?? own.find((g) => g.id === id);
}
