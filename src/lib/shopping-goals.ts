// Adding goals to the shopping list. Kept free of game data so the store (loaded on every page) stays small.
import type { Shopping, ShoppingGoal } from "@/lib/profiles";

const newGoalId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type GoalInput =
  | { kind: "item" | "invention" | "georama"; name: string; qty?: number }
  | { kind: "build"; guideId: string; stepIds: string[] };

/** Adds a goal; the same item/invention/part adds to its quantity, the same guide merges its steps. */
export function addGoal(s: Shopping, input: GoalInput): Shopping {
  if (input.kind === "build") {
    if (!input.stepIds.length) return s;
    const ex = s.goals.find((g) => g.kind === "build" && g.guideId === input.guideId);
    if (ex && ex.kind === "build") {
      const stepIds = [...new Set([...ex.stepIds, ...input.stepIds])];
      return { ...s, goals: s.goals.map((g) => (g === ex ? { ...ex, stepIds } : g)) };
    }
    return { ...s, goals: [{ id: newGoalId(), ...input }, ...s.goals] };
  }
  const qty = Math.max(1, input.qty ?? 1);
  const ex = s.goals.find(
    (g): g is Extract<ShoppingGoal, { name: string }> =>
      g.kind !== "build" && g.kind === input.kind && g.name === input.name,
  );
  if (ex) return { ...s, goals: s.goals.map((g) => (g === ex ? { ...ex, qty: ex.qty + qty } : g)) };
  return {
    ...s,
    goals: [{ id: newGoalId(), kind: input.kind, name: input.name, qty }, ...s.goals],
  };
}
