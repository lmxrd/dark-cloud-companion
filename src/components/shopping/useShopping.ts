import { useMemo } from "react";
import { useActiveGuides } from "@/components/dashboard/useActiveGuides";
import { chapterById } from "@/lib/data";
import { findGuide } from "@/lib/guide/builtin";
import { firstIncompleteChapter } from "@/lib/guide/dashboard";
import { shoppingList } from "@/lib/shopping";

/** The active profile's shopping list, derived for its current chapter (as the dashboard picks it). */
export function useShopping() {
  const { profile, checks, guides } = useActiveGuides();
  const chapterId = profile.dashboard.currentChapter ?? firstIncompleteChapter(guides, checks);
  const ch = chapterById.get(chapterId);
  const chapter = ch && ch.phase === "main" ? ch.number : 8;
  const lookup = useMemo(() => (id: string) => findGuide(id, profile.guides), [profile.guides]);
  const list = useMemo(
    () => shoppingList(profile.shopping, { chapter, findGuide: lookup }),
    [profile.shopping, chapter, lookup],
  );
  return { profile, shopping: profile.shopping, list, chapter, findGuide: lookup };
}
