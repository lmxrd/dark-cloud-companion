import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "@/i18n";
import { withBase } from "@/lib/base";
import {
  itemCounts,
  monsterProgress,
  ridepodProgress,
  sphedaProgress,
  weaponCount,
  type Progress,
} from "@/lib/reference";
import { $checks } from "@/lib/store";

type Tile = { href: string; title: string; meta: string; progress?: Progress };

/** Large tiles for the Reference pages; the trackers show the active profile's progress. */
export function ReferenceHub() {
  const t = useTranslations();
  const checks = useStore($checks);
  // Ticks come from localStorage: count them only after mounting so the first render matches the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const shown = mounted ? checks : {};

  const tracker = (key: "ridepod" | "monsters" | "spheda", progress: Progress): Tile => ({
    href: `/${key}`,
    title: t(`nav.${key}` as const),
    meta: t(`reference.${key}` as const, progress),
    progress,
  });

  const tiles: Tile[] = [
    {
      href: "/weapons",
      title: t("nav.weapons"),
      meta: t("reference.weapons", { count: weaponCount }),
    },
    { href: "/items", title: t("nav.items"), meta: t("reference.items", itemCounts) },
    tracker("ridepod", ridepodProgress(shown)),
    tracker("monsters", monsterProgress(shown)),
    tracker("spheda", sphedaProgress(shown)),
  ];

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {tiles.map((tile) => (
        <li key={tile.href}>
          <a
            href={withBase(tile.href)}
            className="bg-card shadow-sticker flex h-full items-center gap-3 rounded-lg border-2 p-4 transition-[translate,box-shadow] active:translate-x-(--shadow-offset) active:translate-y-(--shadow-offset) active:shadow-none"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-heading text-lg font-extrabold tracking-tight">
                {tile.title}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">{tile.meta}</span>
              {tile.progress && (
                <span
                  role="progressbar"
                  aria-label={tile.title}
                  aria-valuemin={0}
                  aria-valuemax={tile.progress.total}
                  aria-valuenow={tile.progress.done}
                  className="bg-muted h-2 overflow-hidden rounded-full border"
                >
                  <span
                    className="bg-secondary block h-full"
                    style={{ width: `${(100 * tile.progress.done) / (tile.progress.total || 1)}%` }}
                  />
                </span>
              )}
            </span>
            <ChevronRightIcon className="text-muted-foreground size-5 shrink-0" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
