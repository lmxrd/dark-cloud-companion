import data from "@/gamedata/monsters.json";
import type { Monsters } from "./types";

/** `monsters.json` from the game-data export. */
export const monsters = data as unknown as Monsters;
