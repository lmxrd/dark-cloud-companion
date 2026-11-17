import type { AbilityId, Stats } from "@/lib/schemas";

/** How a weapon enters the plan. */
export type Acquire =
  | { kind: "have" }
  | { kind: "shop"; shop: string; price: number; chapter: number }
  | { kind: "invent"; chapter: number; gilda: number };

export interface ItemUse {
  kind: "item";
  /** Synth item name (see `synthItems`). */
  name: string;
  count: number;
}

export interface SphereUse {
  kind: "sphere";
  recipe: Recipe;
  /**
   * Made earlier (in a guide's prepare step) and kept until now: its levelling and items are counted
   * there, so here it only costs the SP to synth it.
   */
  prepared?: boolean;
}

export type SynthUse = ItemUse | SphereUse;

/**
 * One stage = one weapon form: level it, synth things onto it, then (if another stage follows)
 * build it up into the next stage's weapon.
 */
export interface Stage {
  weaponId: string;
  /** Level to reach on this form before synthing / building up. Never below the level already held. */
  levelTo: number;
  synths: SynthUse[];
}

/** A weapon prepared from scratch, e.g. a sphere weapon. The last stage is what gets used. */
export interface Recipe {
  acquire: Acquire;
  stages: Stage[];
}

export interface Plan {
  stages: Stage[];
}

export interface Cost {
  abs: number;
  gilda: number;
  /** Number of discrete player actions (level blocks, synth batches, build-ups, acquisitions). */
  steps: number;
}

export type LogEntry =
  | { type: "acquire"; weaponId: string; acquire: Acquire; depth: number }
  | { type: "level"; weaponId: string; from: number; to: number; abs: number; depth: number }
  | { type: "item"; name: string; count: number; sp: number; gilda: number; depth: number }
  | {
      type: "sphere";
      weaponId: string;
      level: number;
      sp: number;
      gains: Partial<Stats>;
      /** Durability it passes on. */
      du: number;
      /** Abilities it passes on. */
      abilities: AbilityId[];
      depth: number;
    }
  | { type: "buildup"; from: string; to: string; depth: number }
  /** Snapshot after a stage's level-ups and synths, just before any build-up. */
  | {
      type: "state";
      weaponId: string;
      level: number;
      sp: number;
      stats: Stats;
      du: number;
      abilities: string[];
      /** The weapon when the stage began (after any build-up into it). */
      start: { level: number; stats: Stats; du: number };
      depth: number;
    };

export interface SimulationResult {
  cost: Cost;
  log: LogEntry[];
  /** Rule violations; an empty list means the plan is valid. */
  errors: string[];
  /** Per top-level stage: its own errors and cost (only set by `simulatePlan`). */
  stages?: { errors: string[]; cost: Cost }[];
}
