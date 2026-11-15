import { useProfile } from "@/lib/useAppStore";
import { cn } from "cn";
import { useEffect, useMemo, useState } from "react";
import { BookOpenIcon, StarIcon } from "lucide-react";
import { withBase } from "@/lib/base";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { STAT_KEYS, weaponType, type Weapon, type WeaponType } from "@/lib/schemas";
import { useTranslations } from "@/i18n";
import { allGuides } from "@/lib/guide/builtin";
import { finalWeaponIds } from "@/lib/planner/graph";
import { weaponData } from "@/lib/planner/sources";
import { dbHref } from "@/lib/db/routes";
import { byTier } from "@/lib/weapons/info";
import { BuildUpMap } from "./BuildUpMap";
import {
  directed,
  FilterChips,
  Segments,
  SortChips,
  StickyBar,
  type SortDir,
} from "@/components/db/kit";

const SORTS = ["tier", "name", "abs", "sp", ...STAT_KEYS] as const;
type Sort = (typeof SORTS)[number];

/** Weapon types per owner, in the order the list shows them. */
const OWNERS: { owner: "max" | "monica"; types: WeaponType[] }[] = [
  { owner: "max", types: ["wrench", "gun", "club"] },
  { owner: "monica", types: ["sword", "armband"] },
];

const byName = (a: Weapon, b: Weapon) => a.name.localeCompare(b.name);
/** Ascending comparisons; the direction flips them. */
const sorter = (sort: Sort, level: "base" | "max") => (a: Weapon, b: Weapon) => {
  if (sort === "tier") return byTier(a, b);
  if (sort === "name") return byName(a, b);
  if (sort === "abs") return a.baseAbs - b.baseAbs || byName(a, b);
  if (sort === "sp") return a.spPerLevel - b.spPerLevel || byName(a, b);
  const stats = level === "base" ? (w: Weapon) => w.baseStats : (w: Weapon) => w.maxStats;
  return stats(a)[sort] - stats(b)[sort] || byName(a, b);
};

/** Weapons that a switched-on guide builds or builds into. */
function useGuideWeapons(): Set<string> {
  const { guides, activeGuides } = useProfile();
  // Guide switches live in localStorage: mark nothing until mounted (matches the server render).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return useMemo(() => {
    if (!mounted) return new Set();
    const ids = new Set<string>();
    for (const g of allGuides(guides))
      if (activeGuides.includes(g.id))
        for (const s of g.steps) {
          if (s.build) ids.add(s.build.weaponId);
          if (s.buildUp) ids.add(s.buildUp.weaponId);
        }
    return ids;
  }, [mounted, guides, activeGuides]);
}

/**
 * All weapons by owner and type, in build-up order by default. A table view compares the stats of
 * each type side by side; its column headers sort.
 */
export function WeaponList() {
  const t = useTranslations();
  // Search, type, finals, sort, direction, view and stat level live in the query.
  const [q, setQ] = useQueryText("q");
  const [type, setType] = useQueryChoice("type", ["all", ...weaponType.options], "all");
  const [finals, setFinals] = useQueryChoice("finals", ["", "1"], "");
  const finalsOnly = finals === "1";
  const [sort, setSort] = useQueryChoice<Sort>("sort", SORTS, "tier");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const [view, setView] = useQueryChoice("view", ["list", "table", "map"], "list");
  const [level, setLevel] = useQueryChoice("stats", ["max", "base"], "max");
  const inGuides = useGuideWeapons();

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cmp = directed(sorter(sort, level), dir);
    return OWNERS.flatMap(({ owner, types }) =>
      types
        .filter((ty) => type === "all" || type === ty)
        .map((ty) => ({
          owner,
          type: ty,
          // The map shows the whole tree; a search lights up what it finds instead of filtering.
          all: weaponData.weapons.filter((w) => w.type === ty),
          matches: new Set(
            needle
              ? weaponData.weapons
                  .filter((w) => w.type === ty && w.name.toLowerCase().includes(needle))
                  .map((w) => w.id)
              : [],
          ),
          weapons: weaponData.weapons
            .filter(
              (w) =>
                w.type === ty &&
                (!finalsOnly || finalWeaponIds.includes(w.id)) &&
                (!needle || w.name.toLowerCase().includes(needle)),
            )
            .sort(cmp),
        }))
        .filter((g) => (view === "map" ? g.all.length : g.weapons.length)),
    );
  }, [q, type, finalsOnly, sort, dir, level, view]);

  // A header click sorts by that column; clicking the sorted column again flips the direction.
  const sortBy = (s: Sort) => (s === sort ? setDir(dir === "asc" ? "desc" : "asc") : setSort(s));

  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("weapons.search")} value={q} onChange={setQ}>
        <div className="flex flex-wrap items-center gap-2">
          <Segments
            label={t("db.compare")}
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t("db.view.list") },
              { value: "table", label: t("db.view.table") },
              { value: "map", label: t("db.view.map") },
            ]}
          />
          {view === "table" && (
            <Segments
              label={t("weapons.statsTitle")}
              value={level}
              onChange={setLevel}
              options={[
                { value: "max", label: t("db.statsMax") },
                { value: "base", label: t("db.statsBase") },
              ]}
            />
          )}
        </div>
        <FilterChips
          label={t("db.type")}
          value={type}
          onChange={setType}
          options={(["all", ...weaponType.options] as const).map((ty) => ({
            value: ty,
            label: ty === "all" ? t("weapons.all") : t(`weapon.type.${ty}` as const),
          }))}
        />
        {view !== "map" && (
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <SortChips
                value={sort}
                onChange={setSort}
                dir={dir}
                onDir={setDir}
                options={(["tier", "name", "at", "abs", "sp"] as const).map((s) => ({
                  value: s,
                  label: t(`db.sort.${s === "at" ? "attack" : s}` as const),
                }))}
              />
            </div>
            <button
              type="button"
              aria-pressed={finalsOnly}
              onClick={() => setFinals(finalsOnly ? "" : "1")}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap",
                finalsOnly
                  ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
                  : "border-border/40 text-muted-foreground hover:border-border",
              )}
            >
              <StarIcon className="size-3" aria-hidden />
              {t("weapons.finalsOnly")}
            </button>
          </div>
        )}
      </StickyBar>
      {view === "map" && <p className="text-muted-foreground text-xs">{t("db.mapHint")}</p>}

      {groups.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("weapons.noMatch")}</p>
      )}

      {groups.map((g) => (
        <section key={g.type} aria-labelledby={`type-${g.type}`} className="flex flex-col gap-2">
          <h2 id={`type-${g.type}`} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "grid size-6 place-items-center rounded-md border-2 text-[11px] font-extrabold",
                g.owner === "max"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {t(`weapons.${g.owner}Short` as const)}
            </span>
            <span className="font-heading text-base font-extrabold tracking-tight">
              {t(`weapons.${g.owner}` as const)} · {t(`weapon.type.${g.type}` as const)}
            </span>
          </h2>
          {view === "map" ? (
            <BuildUpMap
              weapons={g.all}
              interactive
              matches={g.matches}
              label={`${t(`weapons.${g.owner}` as const)} · ${t(`weapon.type.${g.type}` as const)}`}
            />
          ) : view === "table" ? (
            <WeaponTable weapons={g.weapons} level={level} sort={sort} dir={dir} onSort={sortBy} />
          ) : (
            <ul
              className={cn(
                "bg-card divide-y-2 overflow-hidden rounded-lg border-2 border-l-4",
                g.owner === "max" ? "border-l-primary" : "border-l-secondary",
              )}
            >
              {g.weapons.map((w) => (
                <li key={w.id}>
                  <a
                    href={withBase(dbHref("weapon", w.id))}
                    className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {finalWeaponIds.includes(w.id) && (
                          <StarIcon
                            className="fill-accent size-3.5 shrink-0"
                            role="img"
                            aria-label={t("weapons.final")}
                          />
                        )}
                        <span className="truncate">{w.name}</span>
                        {inGuides.has(w.id) && (
                          <BookOpenIcon
                            className="text-secondary size-3.5 shrink-0"
                            role="img"
                            aria-label={t("weapons.inGuide")}
                          />
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t("weapons.statLine", {
                          tier: w.tier ?? "?",
                          atk: w.maxStats.at,
                          abs: w.baseAbs,
                          sp: w.spPerLevel,
                        })}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {w.abilities.slice(0, 2).map((a) => (
                        <span
                          key={a}
                          className="rounded-full border-2 px-2 py-0.5 text-[11px] font-semibold"
                        >
                          {t(`ability.${a}` as const)}
                        </span>
                      ))}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </Gate>
  );
}

/** One type's weapons side by side: every stat, base ABS and SP; the best value per column is marked. */
function WeaponTable({
  weapons,
  level,
  sort,
  dir,
  onSort,
}: {
  weapons: Weapon[];
  level: "base" | "max";
  sort: Sort;
  dir: SortDir;
  onSort: (s: Sort) => void;
}) {
  const t = useTranslations();
  const stats = (w: Weapon) => (level === "base" ? w.baseStats : w.maxStats);
  const cols: { key: Sort; label: string; value: (w: Weapon) => number; best?: false }[] = [
    { key: "tier", label: t("db.tier"), value: (w) => w.tier ?? 0, best: false },
    ...STAT_KEYS.map((k) => ({
      key: k as Sort,
      label: t(`stat.short.${k}` as const),
      value: (w: Weapon) => stats(w)[k],
    })),
    { key: "abs", label: t("db.sort.abs"), value: (w) => w.baseAbs },
    { key: "sp", label: t("db.sort.sp"), value: (w) => w.spPerLevel },
  ];
  const best = new Map(
    cols.filter((c) => c.best !== false).map((c) => [c.key, Math.max(...weapons.map(c.value))]),
  );
  const header = (key: Sort, label: string, className?: string) => (
    <th
      scope="col"
      aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("px-1.5 py-1.5 font-semibold", className)}
    >
      <button
        type="button"
        onClick={() => onSort(key)}
        className={cn("hover:underline", sort === key && "text-foreground underline decoration-2")}
      >
        {label}
        {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  return (
    <div className="bg-card overflow-x-auto rounded-lg border-2">
      <table className="w-full text-xs tabular-nums">
        <thead className="text-muted-foreground border-b-2 text-right">
          <tr>
            {header("name", t("db.sort.name"), "sticky left-0 bg-card text-left pl-3")}
            {cols.map((c) => header(c.key, c.label))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {weapons.map((w) => (
            <tr key={w.id} className="hover:bg-muted/40">
              <th
                scope="row"
                className="bg-card sticky left-0 max-w-40 truncate py-1.5 pr-2 pl-3 text-left font-semibold"
              >
                <a href={withBase(dbHref("weapon", w.id))} className="hover:underline">
                  {finalWeaponIds.includes(w.id) ? "★ " : ""}
                  {w.name}
                </a>
              </th>
              {cols.map((c) => {
                const v = c.value(w);
                return (
                  <td
                    key={c.key}
                    className={cn(
                      "px-1.5 py-1.5 text-right",
                      v === 0 && "text-muted-foreground/60",
                      v > 0 && v === best.get(c.key) && "bg-accent/60 font-bold",
                    )}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground border-t-2 px-3 py-1.5 text-[11px]">
        {t("db.weaponTableHint")}
      </p>
    </div>
  );
}
