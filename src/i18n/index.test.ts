import { expect, test } from "vitest";
import { useTranslations } from "./index";

test("interpolates variables", () => {
  expect(useTranslations()("chapter.progress", { done: 3, total: 9 })).toBe("3 / 9");
});
