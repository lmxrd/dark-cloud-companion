import data from "@/gamedata/fishing.json";
import type { Fishing } from "./types";

/** `fishing.json` from the game-data export. */
export const fishing = data as unknown as Fishing;
