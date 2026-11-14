import { useChecks } from "@/lib/useAppStore";
import { CheckRow } from "@/components/chapter/CheckRow";
import { TrackerLayout, type TrackerGroup } from "./TrackerLayout";
import { collectables, names, type Invention, type RidepodPart } from "@/lib/gamedata";
import { ridepod } from "@/lib/gamedata/ridepod";
import { tick } from "@/lib/gamedata/ticks";
import { useTranslations } from "@/i18n";
import { setChecked } from "@/lib/store";

const categories = ["short", "long", "armor", "legs", "pack"] as const;
type Category = (typeof categories)[number];

/** Close-range arm families; the others are long-range (schema: RIDEPOD_WEAPON_SUB_TYPES). */
const SHORT_RANGE = new Set([
  "cannonball-arm",
  "clown-hand",
  "samurai-arm",
  "hammer-arm",
  "drill-arm",
]);

const categoryOf = (p: RidepodPart): Category =>
  p.weapon
    ? SHORT_RANGE.has(p.weapon.subType)
      ? "short"
      : "long"
    : p.type === "body"
      ? "armor"
      : p.type === "legs"
        ? "legs"
        : "pack";

const inventionOf = new Map<string, Invention>(
  collectables.inventions.filter((i) => i.ridepodPartId).map((i) => [i.ridepodPartId!, i]),
);

const ready = (inv: Invention | undefined, checks: Record<string, true>) =>
  !!inv && inv.recipes.some((r) => r.every((photo) => checks[tick.photo(photo)]));

const recipeText = (recipe: string[]) => recipe.map((id) => names.photos[id] ?? id).join(" + ");

/** ABS price at Cedric's (or G-Parts), when it can be bought. */
const price = (sources: RidepodPart["sources"]) => sources.shops?.[0]?.price;

const WEAPON_STATS = [
  "attack",
  "flame",
  "chill",
  "lightning",
  "cyclone",
  "smash",
  "exorcism",
  "beast",
  "scale",
] as const;

export function RidepodTracker() {
  const t = useTranslations();
  const checks = useChecks();
  const count = (ids: string[]) => ({
    done: ids.filter((id) => checks[id]).length,
    total: ids.length,
  });
  const partId = (p: RidepodPart) => tick.ridepodPart(p.id);
  const allParts = count(ridepod.parts.map(partId));
  const cores = count(ridepod.cores.map((c) => tick.ridepodCore(c.id)));
  const readyCount = ridepod.parts.filter(
    (p) => !checks[partId(p)] && ready(inventionOf.get(p.id), checks),
  ).length;

  const groups: TrackerGroup[] = [
    ...categories.map((cat) => {
      const parts = ridepod.parts.filter((p) => categoryOf(p) === cat);
      return {
        id: cat,
        label: t(`ridepod.cat.${cat}` as const),
        title: t(`ridepod.cat.${cat}` as const),
        count: count(parts.map(partId)),
        defaultOpen: cat === "short",
        children: parts.map((p) => {
          const built = !!checks[partId(p)];
          const inv = inventionOf.get(p.id);
          const numbers = [
            t("ridepod.capacity", { n: p.capacity }),
            p.weapon ? t("ridepod.whp", { n: p.weapon.weaponHp }) : undefined,
            p.body ? t("ridepod.armorValue", { n: p.body.armor }) : undefined,
            p.energyPack ? t("ridepod.energyValue", { n: p.energyPack.energy }) : undefined,
          ].filter(Boolean);
          const cost = price(p.sources);
          const extra = [
            p.legs ? t("ridepod.speedValue", { n: p.legs.speed }) : undefined,
            ...WEAPON_STATS.flatMap((k) => (p.weapon?.[k] ? [`${p.weapon[k]} ${k}`] : [])),
            cost !== undefined ? t("ridepod.buy", { abs: cost }) : undefined,
          ].filter(Boolean);
          return (
            <CheckRow
              key={p.id}
              checked={built}
              onChange={(v) => setChecked(partId(p), v)}
              label={p.name}
              badges={
                !built && ready(inv, checks) ? (
                  <span className="bg-accent text-accent-foreground rounded-full border-2 px-2 py-0.5 text-[11px] font-bold">
                    {t("ridepod.ready")}
                  </span>
                ) : undefined
              }
              aside={numbers.map((n) => (
                <span key={n} className="block whitespace-nowrap">
                  {n}
                </span>
              ))}
              detail={
                <>
                  {extra.length > 0 && <span className="block">{extra.join(" · ")}</span>}
                  {inv && (
                    <span className="block">
                      {t("ridepod.recipe")}: {recipeText(inv.recipes[0] ?? [])}
                      {inv.recipes[1]
                        ? ` · ${t("ridepod.alternate")}: ${recipeText(inv.recipes[1])}`
                        : ""}
                    </span>
                  )}
                  {inv && inv.items.length > 0 && (
                    <span className="block">
                      {t("ridepod.resources")}:{" "}
                      {inv.items.map((r) => `${r.quantity}× ${names.items[r.itemId]}`).join(", ")}
                    </span>
                  )}
                </>
              }
            />
          );
        }),
      };
    }),
    {
      id: "cores",
      label: t("ridepod.cores"),
      title: t("ridepod.cores"),
      count: cores,
      children: ridepod.cores.map((c) => {
        const cost = price(c.sources);
        return (
          <CheckRow
            key={c.id}
            checked={!!checks[tick.ridepodCore(c.id)]}
            onChange={(v) => setChecked(tick.ridepodCore(c.id), v)}
            label={c.name}
            detail={cost !== undefined ? t("ridepod.coreExp", { abs: cost }) : undefined}
            aside={
              <>
                <span className="block whitespace-nowrap">
                  {t("ridepod.capacity", { n: c.capacity })}
                </span>
                <span className="block whitespace-nowrap">
                  {t("ridepod.coreArmor", { n: c.armorCapacity })}
                </span>
              </>
            }
          />
        );
      }),
    },
  ];

  return (
    <TrackerLayout
      intro={t("ridepod.intro")}
      totals={[
        { label: t("ridepod.totalParts"), ...allParts },
        { label: t("ridepod.cores"), ...cores },
      ]}
      before={
        readyCount > 0 ? (
          <p className="bg-accent text-accent-foreground w-fit rounded-md border-2 px-3 py-1.5 text-sm font-semibold">
            {t("ridepod.readyCount", { n: readyCount })}
          </p>
        ) : undefined
      }
      groups={groups}
    />
  );
}
