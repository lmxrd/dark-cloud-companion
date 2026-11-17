import data from "@/gamedata/shops.json";
import type { Shops } from "./types";

/** `shops.json` from the game-data export. */
export const shops = data as unknown as Shops;
