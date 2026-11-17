import { useEffect, useState } from "react";
import { loadChapterDetail, type ChapterDetail } from "@/lib/gamedata";

/**
 * One chapter's floor detail, loaded on demand. `undefined` until it has loaded, also on the server
 * and the first client render, so hydration always matches.
 */
export function useChapterDetail(chapter: number | undefined): ChapterDetail | undefined {
  const [detail, setDetail] = useState<{ chapter: number; detail: ChapterDetail }>();
  useEffect(() => {
    if (chapter === undefined) return;
    let live = true;
    void loadChapterDetail(chapter).then((d) => live && setDetail({ chapter, detail: d }));
    return () => {
      live = false;
    };
  }, [chapter]);
  return detail && detail.chapter === chapter ? detail.detail : undefined;
}
