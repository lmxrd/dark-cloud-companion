import { useEffect, useMemo, useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { useChecks } from "@/lib/useAppStore";
import { useTranslations, type MessageKey } from "@/i18n";
import { withBase } from "@/lib/base";
import { useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { collectables, core, names } from "@/lib/gamedata";
import { monsters } from "@/lib/gamedata/monsters";
import { tick } from "@/lib/gamedata/ticks";
import {
  dbHref,
  dbListHref,
  monsterFormHref,
  sectionHref,
  type DbKind,
  type DbList,
} from "@/lib/db/routes";
import { monsterProgress, ridepodProgress, sphedaProgress, type Progress } from "@/lib/reference";
import { StickyBar } from "./kit";

type Hit = { name: string; kind: MessageKey; href: string };

/** Everything with a page, by name: built from the always-loaded names, sections and forms. */
function useIndex(): Hit[] {
  return useMemo(() => {
    const out: Hit[] = [];
    const add = (kind: DbKind, table: keyof typeof names) => {
      for (const [id, name] of Object.entries(names[table]))
        out.push({ name, kind: `db.kind.${kind}` as MessageKey, href: dbHref(kind, id) });
    };
    add("weapon", "weapons");
    add("item", "items");
    add("enemy", "enemies");
    add("ridepodPart", "ridepodParts");
    add("ridepodCore", "ridepodCores");
    add("ability", "abilities");
    add("monsterClass", "monsterClasses");
    add("town", "towns");
    add("dungeon", "dungeons");
    add("shop", "shops");
    add("npc", "npcs");
    add("georamaPart", "georamaParts");
    add("fish", "fish");
    add("invention", "inventions");
    add("photo", "photos");
    for (const f of monsters.forms)
      out.push({
        name: f.name,
        kind: "db.kind.monsterForm",
        href: monsterFormHref(f.classId, f.id),
      });
    for (const s of core.sections)
      out.push({
        name: s.title,
        kind: s.type === "dungeon" || s.type === "boss" ? "db.kind.floor" : "db.kind.chapterEvent",
        href: sectionHref(s),
      });
    return out;
  }, []);
}

type Tile = { list: DbList; meta: string; progress?: Progress };

/** The database home: a search across everything, and the lists grouped by what you're after. */
export function DbHome() {
  const t = useTranslations();
  const checks = useChecks();
  // Ticks come from localStorage: count them only after mounting so the first render matches the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const shown = mounted ? checks : {};
  const index = useIndex();
  const [q, setQ] = useQueryText("q", 150);
  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (needle.length < 2) return [];
    const scored = index
      .map((h) => ({ h, at: h.name.toLowerCase().indexOf(needle) }))
      .filter((x) => x.at >= 0)
      .sort(
        (a, b) => (a.at === 0 ? 0 : 1) - (b.at === 0 ? 0 : 1) || a.h.name.length - b.h.name.length,
      );
    return scored.slice(0, 30).map((x) => x.h);
  }, [index, needle]);

  const count = (ids: string[]): Progress => ({
    done: ids.filter((id) => shown[id]).length,
    total: ids.length,
  });
  const n = (o: object) => Object.keys(o).length;
  const groups: { title: MessageKey; tiles: Tile[] }[] = [
    {
      title: "db.group.gear",
      tiles: [
        { list: "weapons", meta: t("reference.weapons", { count: n(names.weapons) }) },
        { list: "items", meta: t("db.tile.items", { n: n(names.items) }) },
        {
          list: "ridepod",
          meta: t("reference.ridepod", ridepodProgress(shown)),
          progress: ridepodProgress(shown),
        },
        { list: "abilities", meta: t("db.tile.abilities", { n: n(names.abilities) }) },
      ],
    },
    {
      title: "db.group.creatures",
      tiles: [
        { list: "bestiary", meta: t("reference.bestiary", { count: n(names.enemies) }) },
        {
          list: "monsters",
          meta: t("reference.monsters", monsterProgress(shown)),
          progress: monsterProgress(shown),
        },
      ],
    },
    {
      title: "db.group.world",
      tiles: [
        {
          list: "places",
          meta: t("db.tile.places", {
            towns: core.towns.length,
            dungeons: core.dungeons.length,
            floors: core.sections.filter((s) => s.type === "dungeon" || s.type === "boss").length,
          }),
        },
        { list: "shops", meta: t("reference.shops", { count: n(names.shops) }) },
        { list: "people", meta: t("reference.people", { count: n(names.npcs) }) },
        { list: "georama", meta: t("db.tile.georama", { n: n(names.georamaParts) }) },
      ],
    },
    {
      title: "db.group.pastimes",
      tiles: [
        { list: "fishing", meta: t("reference.fishing", { fish: n(names.fish) }) },
        (() => {
          const p = count([
            ...collectables.inventions.map((i) => tick.invention(i.id)),
            ...collectables.photos.map((x) => tick.photo(x.id)),
          ]);
          return { list: "inventions", meta: t("db.tile.inventions", p), progress: p } as Tile;
        })(),
        {
          list: "spheda",
          meta: t("reference.spheda", sphedaProgress(shown)),
          progress: sphedaProgress(shown),
        },
        { list: "trophies", meta: t("db.tile.trophies") },
      ],
    },
  ];

  return (
    <Gate on={["url"]} className="flex flex-col gap-6">
      <StickyBar
        label={t("db.search", { n: index.length.toLocaleString("en") })}
        value={q}
        onChange={setQ}
      />
      {needle.length >= 2 && (
        <section aria-label={t("db.searchLabel")} className="flex flex-col gap-2">
          {hits.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("db.noResults")}</p>
          ) : (
            <ul className="bg-card flex flex-col divide-y-2 overflow-hidden rounded-lg border-2">
              {hits.map((h) => (
                <li key={h.href + h.kind}>
                  <a
                    href={withBase(h.href)}
                    className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{h.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{t(h.kind)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {t(g.title)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.tiles.map((tile) => (
              <li key={tile.list}>
                <a
                  href={withBase(dbListHref(tile.list))}
                  className="bg-card shadow-sticker flex h-full items-center gap-3 rounded-lg border-2 p-4 transition-[translate,box-shadow] active:translate-x-(--shadow-offset) active:translate-y-(--shadow-offset) active:shadow-none"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="font-heading text-lg font-extrabold tracking-tight">
                      {t(`nav.${tile.list}` as const)}
                    </span>
                    <span className="text-muted-foreground text-sm tabular-nums">{tile.meta}</span>
                    {tile.progress && (
                      <span
                        role="progressbar"
                        aria-label={t(`nav.${tile.list}` as const)}
                        aria-valuemin={0}
                        aria-valuemax={tile.progress.total}
                        aria-valuenow={tile.progress.done}
                        className="bg-muted h-2 overflow-hidden rounded-full border"
                      >
                        <span
                          className="bg-secondary block h-full"
                          style={{
                            width: `${(100 * tile.progress.done) / (tile.progress.total || 1)}%`,
                          }}
                        />
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon className="text-muted-foreground size-5 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Gate>
  );
}
