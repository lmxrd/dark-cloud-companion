import { useMemo, useState } from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass, WeaponSelect } from "@/components/planner/WeaponSelect";
import { useTranslations } from "@/i18n";
import { STAT_KEYS, type Stats, type StatKey } from "@/lib/schemas";
import { getWeapon, synthSources, weaponData } from "@/lib/planner/sources";
import { simulateRecipe } from "@/lib/planner/simulate";
import type { Recipe } from "@/lib/planner/types";
import { attackTransfer, MIN_SPHERE_LEVEL, SPECTRUMIZE_KEEP } from "@/lib/weapons/mechanics";

/** Items that add stats (coins and other ability items are left out). */
const statItems = synthSources
  .filter((s) => !s.ability && STAT_KEYS.some((k) => (s.gains[k] ?? 0) > 0))
  .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.name.localeCompare(b.name));
const itemByName = new Map(statItems.map((s) => [s.name, s]));

const clampInt = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

/** Weapons that build up into each weapon. */
const parents = new Map<string, string[]>();
for (const w of weaponData.weapons)
  for (const to of w.buildsUpTo) parents.set(to, [...(parents.get(to) ?? []), w.id]);

/** Routes of up to two build-ups into a weapon (its earlier weapons, first first). */
function routesInto(id: string): string[][] {
  const out: string[][] = [];
  const walk = (at: string, before: string[]) => {
    if (before.length) out.push(before);
    if (before.length >= 2) return;
    for (const p of parents.get(at) ?? []) walk(p, [p, ...before]);
  };
  walk(id, []);
  return out;
}

/** The recipe: the earlier weapons at their levels, then the weapon itself (no items here). */
const recipeOf = (
  earlier: string[],
  levels: number[],
  weaponId: string,
  level: number,
): Recipe => ({
  acquire: { kind: "have" },
  stages: [
    ...earlier.map((id, i) => ({ weaponId: id, levelTo: levels[i] ?? 0, synths: [] })),
    { weaponId, levelTo: level, synths: [] },
  ],
});

/** For each earlier weapon, the lowest level from which the build-up after it works. */
function lowestLevels(earlier: string[], weaponId: string, support: boolean): number[] {
  const levels: number[] = [];
  earlier.forEach((_, i) => {
    const next = earlier[i + 1] ?? weaponId;
    let found = 30;
    for (let l = 0; l <= 30; l++) {
      const r = simulateRecipe(recipeOf(earlier.slice(0, i + 1), [...levels, l], next, 0), {
        spBonus: support ? 1 : 0,
      });
      if (!r.errors.length) {
        found = l;
        break;
      }
    }
    levels.push(found);
  });
  return levels;
}

/**
 * Synth sphere calculator: a side weapon at a level, filled with items (or with stats typed in), and
 * what its sphere passes on to the weapon it is synthed onto. Spectrumizing keeps 60% of each stat
 * (and of Du); Attack depends on the receiving weapon's Attack.
 */
export function SphereCalculator() {
  const t = useTranslations();
  const [weaponId, setWeaponId] = useState("true-battle-wrench");
  const [level, setLevel] = useState(MIN_SPHERE_LEVEL);
  const [support, setSupport] = useState(true);
  const [items, setItems] = useState<{ name: string; count: number }[]>([]);
  const [pick, setPick] = useState(statItems[0]?.name ?? "");
  /** Stats typed in by hand, on top of the levels and items. */
  const [extra, setExtra] = useState<Partial<Stats>>({});
  const [receiverId, setReceiverId] = useState("island-king");
  const [receiverAt, setReceiverAt] = useState(() => getWeapon("island-king").baseStats.at);
  /** Built up from these weapons first ("" = the weapon as bought), and their levels. */
  const [route, setRoute] = useState("battle-wrench");
  const [earlierLevels, setEarlierLevels] = useState(() =>
    lowestLevels(["battle-wrench"], "true-battle-wrench", true),
  );

  const weapon = getWeapon(weaponId);
  const routes = useMemo(() => routesInto(weaponId), [weaponId]);
  const earlier = route ? route.split(">") : [];
  const made = useMemo(
    () =>
      simulateRecipe(recipeOf(route ? route.split(">") : [], earlierLevels, weaponId, level), {
        spBonus: support ? 1 : 0,
      }),
    [route, earlierLevels, weaponId, level, support],
  );
  const levelled = made.state;
  const chooseRoute = (next: string, w = weaponId) => {
    setRoute(next);
    setEarlierLevels(next ? lowestLevels(next.split(">"), w, support) : []);
  };
  const spUsed = items.reduce((n, i) => n + i.count, 0);
  const spLeft = levelled.sp - spUsed;
  // The side weapon's stats: levels, then items (capped at its maximum), then typed-in stats.
  const stats = useMemo(() => {
    const s = { ...levelled.stats };
    for (const { name, count } of items) {
      const src = itemByName.get(name);
      for (const k of STAT_KEYS) s[k] += (src?.gains[k] ?? 0) * count;
    }
    for (const k of STAT_KEYS) s[k] = Math.min(s[k] + (extra[k] ?? 0), weapon.maxStats[k]);
    return s;
  }, [levelled, items, extra, weapon]);
  const passes = (k: StatKey) =>
    k === "at" ? attackTransfer(receiverAt, stats.at) : Math.floor(SPECTRUMIZE_KEEP * stats[k]);
  const du = Math.floor(SPECTRUMIZE_KEEP * levelled.du);
  const abilities = level >= MIN_SPHERE_LEVEL ? levelled.abilities : [];

  const addItem = (name: string, n: number) =>
    setItems((list) => {
      const found = list.find((i) => i.name === name);
      if (!found) return n > 0 ? [...list, { name, count: n }] : list;
      return list
        .map((i) => (i.name === name ? { ...i, count: Math.max(0, i.count + n) } : i))
        .filter((i) => i.count > 0);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section
        className="bg-card flex flex-col gap-3 rounded-lg border-2 p-4"
        aria-label={t("sphere.weapon")}
      >
        <h2 className="font-heading font-extrabold tracking-tight">{t("sphere.weapon")}</h2>
        <Label className="flex flex-col items-start gap-1">
          {t("sphere.sideWeapon")}
          <WeaponSelect
            value={weaponId}
            onChange={(id) => {
              setWeaponId(id);
              setItems([]);
              setExtra({});
              chooseRoute("", id);
            }}
          />
        </Label>
        {routes.length > 0 && (
          <Label className="flex flex-col items-start gap-1">
            {t("sphere.builtFrom")}
            <select
              className={selectClass}
              value={route}
              onChange={(e) => chooseRoute(e.target.value)}
            >
              <option value="">{t("sphere.asBought")}</option>
              {routes.map((r) => (
                <option key={r.join(">")} value={r.join(">")}>
                  {[...r, weaponId].map((id) => getWeapon(id).name).join(" → ")}
                </option>
              ))}
            </select>
          </Label>
        )}
        {earlier.map((id, i) => (
          <Label key={id} className="flex flex-col items-start gap-1">
            {t("sphere.levelOf", { weapon: getWeapon(id).name })}
            <Input
              type="number"
              min={0}
              max={99}
              className="w-24"
              value={earlierLevels[i] ?? 0}
              onChange={(e) =>
                setEarlierLevels((ls) =>
                  earlier.map((_, n) => (n === i ? clampInt(e.target.value, 99) : (ls[n] ?? 0))),
                )
              }
            />
          </Label>
        ))}
        <div className="flex flex-wrap items-end gap-4">
          <Label className="flex flex-col items-start gap-1">
            {t("planner.level")}
            <Input
              type="number"
              min={0}
              max={99}
              className="w-24"
              value={level}
              onChange={(e) => setLevel(clampInt(e.target.value, 99))}
            />
          </Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={support}
              onChange={(e) => {
                const on = e.target.checked;
                setSupport(on);
                // The levels picked for the route depend on the SP per level.
                setEarlierLevels(route ? lowestLevels(route.split(">"), weaponId, on) : []);
              }}
            />
            {t("planner.support")}
          </label>
        </div>
        <p className={cn("text-sm tabular-nums", spLeft < 0 && "text-destructive")}>
          {t("sphere.sp", { used: spUsed, total: levelled.sp })} ·{" "}
          {t("sphere.absCost", { n: Math.round(made.cost.abs).toLocaleString("en-US") })}
        </p>
        {made.errors.length > 0 && (
          <ul className="text-destructive list-disc pl-5 text-xs">
            {made.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Label className="flex min-w-48 flex-1 flex-col items-start gap-1">
            {t("sphere.addItem")}
            <select className={selectClass} value={pick} onChange={(e) => setPick(e.target.value)}>
              {statItems.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ·{" "}
                  {STAT_KEYS.filter((k) => s.gains[k])
                    .map((k) => `${t(`stat.short.${k}` as const)} +${s.gains[k]}`)
                    .join(" ")}
                  {s.price !== undefined ? ` · ${t("sphere.itemPrice", { n: s.price })}` : ""}
                </option>
              ))}
            </select>
          </Label>
          <Button variant="outline" onClick={() => addItem(pick, 1)}>
            +1
          </Button>
          <Button variant="outline" onClick={() => addItem(pick, Math.max(1, spLeft))}>
            {t("sphere.fill")}
          </Button>
        </div>
        {items.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm" aria-label={t("sphere.items")}>
            {items.map((i) => (
              <li key={i.name} className="flex items-center gap-2">
                <span className="flex-1">
                  {i.count}× {i.name}
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("sphere.less", { name: i.name })}
                  onClick={() => addItem(i.name, -1)}
                >
                  <MinusIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("sphere.more", { name: i.name })}
                  onClick={() => addItem(i.name, 1)}
                >
                  <PlusIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("sphere.remove", { name: i.name })}
                  onClick={() => addItem(i.name, -i.count)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-muted-foreground mb-1 text-xs">{t("sphere.extraStats")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {STAT_KEYS.map((k) => (
              <Label key={k} className="flex flex-col items-start gap-0.5 text-xs">
                {t(`stat.${k}` as const)}
                <Input
                  type="number"
                  min={0}
                  max={999}
                  className="h-8"
                  value={extra[k] ?? 0}
                  onChange={(e) => setExtra((x) => ({ ...x, [k]: clampInt(e.target.value, 999) }))}
                />
              </Label>
            ))}
          </div>
        </fieldset>
      </section>

      <section
        className="bg-card flex flex-col gap-3 rounded-lg border-2 p-4"
        aria-label={t("sphere.result")}
      >
        <h2 className="font-heading font-extrabold tracking-tight">{t("sphere.result")}</h2>
        <div className="flex flex-wrap items-end gap-4">
          <Label className="flex min-w-48 flex-1 flex-col items-start gap-1">
            {t("sphere.receiver")}
            <WeaponSelect
              value={receiverId}
              onChange={(id) => (setReceiverId(id), setReceiverAt(getWeapon(id).baseStats.at))}
            />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t("sphere.receiverAt")}
            <Input
              type="number"
              min={0}
              max={999}
              className="w-24"
              value={receiverAt}
              onChange={(e) => setReceiverAt(clampInt(e.target.value, 999))}
            />
          </Label>
        </div>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-muted-foreground text-xs">
            <tr>
              <th className="text-left font-medium">{t("sphere.stat")}</th>
              <th className="text-right font-medium">{t("sphere.own", { weapon: weapon.name })}</th>
              <th className="text-right font-medium">{t("sphere.passes")}</th>
            </tr>
          </thead>
          <tbody>
            {STAT_KEYS.map((k) => (
              <tr key={k} className="border-t">
                <td className="py-1">{t(`stat.${k}` as const)}</td>
                <td className="py-1 text-right">
                  {stats[k]}
                  <span className="text-muted-foreground"> / {weapon.maxStats[k]}</span>
                </td>
                <td className="py-1 text-right font-semibold">+{passes(k)}</td>
              </tr>
            ))}
            <tr className="border-t">
              <td className="py-1">{t("sphere.du")}</td>
              <td className="py-1 text-right">{levelled.du}</td>
              <td className="py-1 text-right font-semibold">+{du}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm">
          {t("sphere.cost", { sp: level })} ·{" "}
          {abilities.length
            ? t("sphere.abilities", {
                list: abilities.map((a) => t(`ability.${a}` as const)).join(", "),
              })
            : t("sphere.noAbilities")}
        </p>
        {level < MIN_SPHERE_LEVEL && (
          <p className="text-destructive text-sm">{t("sphere.tooLow", { n: MIN_SPHERE_LEVEL })}</p>
        )}
        <p className="text-muted-foreground text-xs">{t("sphere.rules")}</p>
      </section>
    </div>
  );
}
