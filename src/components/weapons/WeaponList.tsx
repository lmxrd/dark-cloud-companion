import { useProfile } from "@/lib/useAppStore";
import { cn } from "cn";
import { useEffect, useMemo, useState } from "react";
import { BookOpenIcon, SearchIcon, StarIcon } from "lucide-react";
import { withBase } from "@/lib/base";
import { weaponType, type Weapon, type WeaponType } from "@/lib/schemas";
import { useTranslations } from "@/i18n";
import { allGuides } from "@/lib/guide/builtin";
import { finalWeaponIds } from "@/lib/planner/graph";
import { weaponData } from "@/lib/planner/sources";

type Sort = "name" | "attack" | "abs" | "sp";

/** Weapon types per owner, in the order the list shows them. */
const OWNERS: { owner: "max" | "monica"; types: WeaponType[] }[] = [
  { owner: "max", types: ["wrench", "gun", "club"] },
  { owner: "monica", types: ["sword", "armband"] },
];

const sorters: Record<Sort, (a: Weapon, b: Weapon) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  attack: (a, b) => b.maxStats.at - a.maxStats.at || a.name.localeCompare(b.name),
  abs: (a, b) => b.baseAbs - a.baseAbs || a.name.localeCompare(b.name),
  sp: (a, b) => b.spPerLevel - a.spPerLevel || a.name.localeCompare(b.name),
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
        for (const s of g.steps) if (s.build) ids.add(s.build.weaponId);
    return ids;
  }, [mounted, guides, activeGuides]);
}

export function WeaponList() {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [finalsOnly, setFinalsOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const inGuides = useGuideWeapons();

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return OWNERS.map(({ owner, types }) => ({
      owner,
      groups: types
        .filter((ty) => type === "all" || type === ty)
        .map((ty) => ({
          type: ty,
          weapons: weaponData.weapons
            .filter(
              (w) =>
                w.type === ty &&
                (!finalsOnly || finalWeaponIds.includes(w.id)) &&
                (!needle || w.name.toLowerCase().includes(needle)),
            )
            .sort(sorters[sort]),
        }))
        .filter((g) => g.weapons.length),
    })).filter((s) => s.groups.length);
  }, [q, type, finalsOnly, sort]);

  const chip = (active: boolean) =>
    cn(
      "flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap",
      active
        ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
        : "border-border/40 text-muted-foreground hover:border-border",
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-background/95 sticky top-0 z-20 -mx-4 flex flex-col gap-2 px-4 py-2 backdrop-blur">
        <div className="flex gap-2">
          <label className="bg-card focus-within:ring-ring flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border-2 px-3 focus-within:ring-2">
            <SearchIcon className="text-muted-foreground size-4" aria-hidden />
            <input
              type="search"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder={t("weapons.searchCount", { n: weaponData.weapons.length })}
              aria-label={t("weapons.search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            className="bg-card h-10 rounded-md border-2 px-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label={t("weapons.sort")}
          >
            {(["name", "attack", "abs", "sp"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`weapons.sort.${s}` as const)}
              </option>
            ))}
          </select>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-0.5 pb-1.5 [scrollbar-width:none]">
          <div role="tablist" aria-label={t("weapons.title")} className="flex gap-1.5">
            {(["all", ...weaponType.options] as const).map((ty) => (
              <button
                key={ty}
                type="button"
                role="tab"
                aria-selected={type === ty}
                onClick={() => setType(ty)}
                className={chip(type === ty)}
              >
                {ty === "all" ? t("weapons.all") : t(`weapon.type.${ty}` as const)}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={finalsOnly}
            onClick={() => setFinalsOnly(!finalsOnly)}
            className={chip(finalsOnly)}
          >
            <StarIcon className="size-3" aria-hidden />
            {t("weapons.finalsOnly")}
          </button>
        </div>
      </div>

      {sections.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("weapons.noMatch")}</p>
      )}

      {sections.map(({ owner, groups }) =>
        groups.map((g) => (
          <section key={g.type} aria-labelledby={`type-${g.type}`} className="flex flex-col gap-2">
            <h2 id={`type-${g.type}`} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "grid size-6 place-items-center rounded-md border-2 text-[11px] font-extrabold",
                  owner === "max"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {t(`weapons.${owner}Short` as const)}
              </span>
              <span className="font-heading text-base font-extrabold tracking-tight">
                {t(`weapons.${owner}` as const)} · {t(`weapon.type.${g.type}` as const)}
              </span>
            </h2>
            <ul
              className={cn(
                "bg-card divide-y-2 overflow-hidden rounded-lg border-2 border-l-4",
                owner === "max" ? "border-l-primary" : "border-l-secondary",
              )}
            >
              {g.weapons.map((w) => {
                const final = finalWeaponIds.includes(w.id);
                return (
                  <li key={w.id}>
                    <a
                      href={withBase(`/weapons/${w.id}`)}
                      className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          {final && (
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
                );
              })}
            </ul>
          </section>
        )),
      )}
    </div>
  );
}
