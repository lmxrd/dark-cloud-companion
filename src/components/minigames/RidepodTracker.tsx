import { useStore } from "@nanostores/react";
import { CheckRow } from "@/components/chapter/CheckRow";
import { TrackerLayout, type TrackerGroup } from "./TrackerLayout";
import { ridepod, ridepodCoreCheckId, ridepodPartCheckId } from "@/lib/reference";
import type { RidepodPart } from "@/lib/schemas";
import { useTranslations } from "@/i18n";
import { ingredientIdByName } from "@/lib/data";
import { $checks, setChecked } from "@/lib/store";

const data = ridepod;
const categories = ["short", "long", "armor", "legs", "pack"] as const;

const partCheckId = ridepodPartCheckId;
const coreCheckId = ridepodCoreCheckId;

function ready(p: RidepodPart, checks: Record<string, true>) {
  const ok = (list: RidepodPart["invent"]) =>
    list.every((i) => checks[ingredientIdByName.get(i.name.toLowerCase()) ?? ""]);
  return ok(p.invent) || (!!p.alternate && ok(p.alternate));
}

const recipeText = (list: RidepodPart["invent"]) =>
  list.map((i) => (i.scoop ? `${i.name} (scoop)` : i.name)).join(" + ");

export function RidepodTracker() {
  const t = useTranslations();
  const checks = useStore($checks);
  const count = (ids: string[]) => ({
    done: ids.filter((id) => checks[id]).length,
    total: ids.length,
  });
  const partsOf = (cat: (typeof categories)[number]) =>
    data.parts.filter((p) => p.category === cat);
  const allParts = count(data.parts.map(partCheckId));
  const cores = count(data.cores.map((c) => coreCheckId(c.name)));
  const readyCount = data.parts.filter((p) => !checks[partCheckId(p)] && ready(p, checks)).length;

  const groups: TrackerGroup[] = [
    ...categories.map((cat) => {
      const parts = partsOf(cat);
      return {
        id: cat,
        label: t(`ridepod.cat.${cat}` as const),
        title: t(`ridepod.cat.${cat}` as const),
        count: count(parts.map(partCheckId)),
        defaultOpen: cat === "short",
        children: parts.map((p) => {
          const built = !!checks[partCheckId(p)];
          const numbers = [
            t("ridepod.capacity", { n: p.capacity }),
            p.whp !== undefined ? t("ridepod.whp", { n: p.whp }) : undefined,
            p.armor !== undefined ? t("ridepod.armorValue", { n: p.armor }) : undefined,
            p.energy !== undefined ? t("ridepod.energyValue", { n: p.energy }) : undefined,
          ].filter(Boolean);
          const extra = [
            p.speed ? t("ridepod.speedValue", { n: p.speed }) : undefined,
            ...Object.entries(p.stats ?? {}).map(([k, v]) => `${v} ${k}`),
            p.buyExp ? t("ridepod.buy", { exp: p.buyExp }) : undefined,
          ].filter(Boolean);
          return (
            <CheckRow
              key={p.id}
              checked={built}
              onChange={(v) => setChecked(partCheckId(p), v)}
              label={p.name}
              badges={
                !built && ready(p, checks) ? (
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
                  <span className="block">
                    {t("ridepod.recipe")}: {recipeText(p.invent)}
                    {p.alternate ? ` · ${t("ridepod.alternate")}: ${recipeText(p.alternate)}` : ""}
                  </span>
                  <span className="block">
                    {t("ridepod.resources")}:{" "}
                    {p.resources.map((r) => `${r.qty}× ${r.name}`).join(", ")}
                  </span>
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
      children: data.cores.map((c) => (
        <CheckRow
          key={c.name}
          checked={!!checks[coreCheckId(c.name)]}
          onChange={(v) => setChecked(coreCheckId(c.name), v)}
          label={c.name}
          detail={c.exp ? t("ridepod.coreExp", { exp: c.exp }) : undefined}
          aside={
            <>
              <span className="block whitespace-nowrap">
                {t("ridepod.capacity", { n: c.capacity })}
              </span>
              <span className="block whitespace-nowrap">
                {t("ridepod.coreArmor", { n: c.armor })}
              </span>
            </>
          }
        />
      )),
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
