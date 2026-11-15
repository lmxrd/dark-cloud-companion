import { useId, useState } from "react";
import { useTranslations } from "@/i18n";
import { MAX_LEVEL, absBetween, absForNextLevel } from "@/lib/weapons/mechanics";

const clamp = (n: number) => Math.max(0, Math.min(MAX_LEVEL, Math.round(n) || 0));

/** ABS to level a weapon from one level to another (default +0 → +5), with the cost of each level. */
export function AbsRange({ baseAbs }: { baseAbs: number }) {
  const t = useTranslations();
  const id = useId();
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(5);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const total = Math.round(absBetween(baseAbs, lo, hi));
  const steps = Array.from({ length: hi - lo }, (_, i) => ({
    level: lo + i + 1,
    abs: Math.round(absForNextLevel(baseAbs, lo + i)),
  }));
  const shown = steps.length > 12 ? [...steps.slice(0, 6), null, ...steps.slice(-5)] : steps;
  const max = Math.max(1, ...steps.map((s) => s.abs));
  const input = (label: string, value: number, set: (n: number) => void, key: string) => (
    <label className="flex items-center gap-2 text-sm font-semibold" htmlFor={`${id}-${key}`}>
      {label}
      <span className="bg-background flex items-center rounded-md border-2">
        <span className="text-muted-foreground pl-2">+</span>
        <input
          id={`${id}-${key}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_LEVEL}
          value={value}
          onChange={(e) => set(clamp(Number(e.target.value)))}
          className="w-14 bg-transparent px-1 py-1 tabular-nums outline-none"
        />
      </span>
    </label>
  );
  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border-2 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {input(t("db.absFrom"), from, setFrom, "from")}
        {input(t("db.absTo"), to, setTo, "to")}
        <output
          className="font-heading ml-auto text-xl font-extrabold tabular-nums"
          aria-live="polite"
        >
          {t("db.absTotal", { n: total.toLocaleString("en") })}
        </output>
      </div>
      {steps.length > 0 && (
        <ol className="flex items-end gap-1.5" aria-label={t("db.absPerLevel")}>
          {shown.map((s) =>
            s === null ? (
              <li key="gap" className="text-muted-foreground self-center text-xs">
                …
              </li>
            ) : (
              <li
                key={s.level}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                title={t("db.absStep", { level: s.level, n: s.abs.toLocaleString("en") })}
              >
                <span className="flex h-20 w-full items-end" aria-hidden>
                  <span
                    className="bg-secondary w-full rounded-t-sm border-2 border-b-0"
                    style={{ height: `${Math.max(6, (100 * s.abs) / max)}%` }}
                  />
                </span>
                <span className="text-muted-foreground text-[10px] font-semibold">+{s.level}</span>
                <span className="text-[10px] font-semibold tabular-nums">
                  {s.abs.toLocaleString("en")}
                </span>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}
