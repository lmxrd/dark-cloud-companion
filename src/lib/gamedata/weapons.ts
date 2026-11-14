import data from "@/gamedata/weapons.json";
import type { Weapons } from "./types";

/** `weapons.json` from the game-data export. */
export const weapons = data as unknown as Weapons;
