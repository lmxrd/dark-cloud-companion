/** Vitest global setup: tests read the exported game data, so export it first. */
import { exportGameData } from "./export.ts";

export default function setup() {
  exportGameData();
}
