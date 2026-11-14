import { cn } from "cn";
import { STAT_KEYS, type StatKey, type Stats } from "@/lib/schemas";
import { useTranslations } from "@/i18n";
import { getWeapon } from "@/lib/planner/sources";

/**
 * Required specs for the finished weapon: a Min / Max / Custom preset control over a 3×3 grid of
 * stat tiles (value plus a bar against the weapon's maximum), and the level.
 */
export function TargetSpecs({
  weaponId,
  stats,
  level,
  onStats,
  onLevel,
}: {
  weaponId: string;
  stats: Stats;
  level: number;
  onStats: (s: Stats) => void;
  onLevel: (n: number) => void;
}) {
  const t = useTranslations();
  const weapon = getWeapon(weaponId);
  const max = weapon.maxStats;
  const set = (k: StatKey, n: number) =>
    onStats({ ...stats, [k]: Math.min(max[k], Math.max(0, n)) });
  const equals = (s: Stats) => STAT_KEYS.every((k) => stats[k] === s[k]);
  const preset = equals(weapon.maxStats) ? "max" : equals(weapon.baseStats) ? "min" : "custom";
  const segment = (active: boolean) =>
    cn(
      "flex-1 rounded-[5px] border-2 px-3 py-1 text-xs font-semibold",
      active ? "bg-card shadow-sticker-sm" : "text-muted-foreground border-transparent",
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{t("planner.targetStats")}</span>
        <div
          role="group"
          aria-label={t("planner.specsPreset")}
          className="bg-muted/60 flex rounded-lg border-2 p-0.5"
        >
          <button
            type="button"
            title={t("planner.specs.minHint")}
            aria-pressed={preset === "min"}
            onClick={() => onStats({ ...weapon.baseStats })}
            className={segment(preset === "min")}
          >
            {t("planner.specs.min")}
          </button>
          <button
            type="button"
            title={t("planner.specs.maxHint")}
            aria-pressed={preset === "max"}
            onClick={() => onStats({ ...weapon.maxStats })}
            className={segment(preset === "max")}
          >
            {t("planner.specs.max")}
          </button>
          <span aria-hidden className={segment(preset === "custom")}>
            {t("planner.specs.custom")}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {STAT_KEYS.map((k) => {
          const pct = max[k] ? Math.round((stats[k] / max[k]) * 100) : 0;
          return (
            <label
              key={k}
              className="bg-card focus-within:ring-ring flex flex-col gap-1 rounded-md border-2 px-2 pt-1 pb-1.5 focus-within:ring-2"
            >
              <span className="text-muted-foreground flex items-baseline justify-between gap-1 text-[11px] font-semibold">
                <span className="truncate">{t(`stat.${k}` as const)}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">/{max[k]}</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={max[k]}
                value={stats[k]}
                aria-label={`${t(`stat.${k}` as const)} ≤ ${max[k]}`}
                onChange={(e) => set(k, Math.floor(Number(e.target.value) || 0))}
                className="w-full bg-transparent text-lg font-extrabold tabular-nums outline-none"
              />
              <span aria-hidden className="bg-muted h-1.5 overflow-hidden rounded-full">
                <span className="bg-primary block h-full" style={{ width: `${pct}%` }} />
              </span>
            </label>
          );
        })}
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>{t("planner.targetLevel")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          value={level}
          onChange={(e) =>
            onLevel(Math.min(99, Math.max(0, Math.floor(Number(e.target.value) || 0))))
          }
          className="bg-card w-20 rounded-md border-2 px-2 py-1 text-right tabular-nums"
        />
      </label>
      <p className="text-muted-foreground text-xs">{t("planner.targetSpecsHint")}</p>
    </div>
  );
}
