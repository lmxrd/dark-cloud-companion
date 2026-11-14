/** Vitest global setup: tests read the exported game data and the built-in plans, so make both. */
import { assemblePlans } from "../../integrations/plans.ts";
import { exportGameData } from "./export.ts";

export default function setup() {
  exportGameData();
  assemblePlans();
}
