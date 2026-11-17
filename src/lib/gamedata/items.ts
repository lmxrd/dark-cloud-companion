import data from "@/gamedata/items.json";
import type { Items } from "./types";

/** `items.json` from the game-data export. */
export const items = data as unknown as Items;
