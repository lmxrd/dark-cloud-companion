import { useMemo, useState } from "react";
import { cn } from "cn";
import { InfoIcon, SearchIcon } from "lucide-react";
import { STAT_KEYS, type StatKey } from "@/lib/schemas";
import { useTranslations } from "@/i18n";
import { itemAvailability, synthSources } from "@/lib/planner/sources";

type Filter = "all" | "buyable" | "found";

/** Short stat names for the chips ("Lght +10"). */
const short = (t: ReturnType<typeof useTranslations>, k: StatKey) => t(`stat.short.${k}` as const);

/**
 * All synth items with their gains and whether they can be bought or only found. "Gives" narrows the
 * list to items that add one stat, sorted by how much.
 */
export function ItemsList() {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");
  const [gives, setGives] = useState<StatKey | null>(null);
  const [q, setQ] = useState("");
  const [showNote, setShowNote] = useState(false);
  const needle = q.trim().toLowerCase();

  const groups = useMemo(() => {
    const byCategory = new Map<string, typeof synthSources>();
    const pool = synthSources.filter((s) => {
      const a = itemAvailability(s.name);
      if (filter === "buyable" && a.kind !== "buyable") return false;
      if (filter === "found" && a.kind !== "found") return false;
      if (gives && !((s.gains[gives] ?? 0) > 0)) return false;
      return !needle || s.name.toLowerCase().includes(needle);
    });
    // With a stat picked, one list sorted by that stat beats category groups.
    if (gives)
      return [
        [
          t("items.givesList", { stat: t(`stat.${gives}` as const) }),
          [...pool].sort((a, b) => (b.gains[gives] ?? 0) - (a.gains[gives] ?? 0)),
        ] as const,
      ];
    for (const s of pool) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
    return [...byCategory];
  }, [filter, needle, gives, t]);

  const counts = useMemo(() => {
    const found = synthSources.filter((s) => itemAvailability(s.name).kind === "found").length;
    return { all: synthSources.length, buyable: synthSources.length - found, found };
  }, []);

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap",
      active
        ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
        : "border-border/40 text-muted-foreground hover:border-border",
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">{t("items.introShort")}</p>
        <button
          type="button"
          aria-expanded={showNote}
          aria-label={t("items.noteLabel")}
          onClick={() => setShowNote(!showNote)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <InfoIcon className="size-4" />
        </button>
      </div>
      {showNote && (
        <p className="bg-card text-muted-foreground rounded-md border-2 px-3 py-2 text-xs">
          {t("items.note")}
        </p>
      )}

      <div className="bg-background/95 sticky top-0 z-20 -mx-4 flex flex-col gap-2 px-4 py-2 backdrop-blur">
        <label className="bg-card focus-within:ring-ring flex h-10 items-center gap-2 rounded-md border-2 px-3 focus-within:ring-2">
          <SearchIcon className="text-muted-foreground size-4" aria-hidden />
          <input
            type="search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder={t("items.search")}
            aria-label={t("items.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div
          role="radiogroup"
          aria-label={t("items.title")}
          className="bg-muted/60 flex w-full rounded-lg border-2 p-0.5 sm:w-fit"
        >
          {(["all", "buyable", "found"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 rounded-md border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap sm:flex-none",
                filter === f
                  ? "bg-card shadow-sticker-sm"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {t(`items.seg.${f}` as const)} <span className="tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label={t("items.gives")}
          className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        >
          <span className="text-muted-foreground shrink-0 text-xs font-semibold">
            {t("items.gives")}:
          </span>
          {STAT_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={gives === k}
              onClick={() => setGives(gives === k ? null : k)}
              className={chip(gives === k)}
            >
              {t(`stat.${k}` as const)}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className="text-muted-foreground text-sm">{t("items.noMatch")}</p>}
      {groups.map(([category, items]) => (
        <section key={category} className="flex flex-col gap-2">
          <h2 className="font-heading text-base font-extrabold tracking-tight">{category}</h2>
          <ul className="bg-card flex flex-col divide-y-2 overflow-hidden rounded-lg border-2">
            {items.map((s) => {
              const a = itemAvailability(s.name);
              const gains = STAT_KEYS.filter((k) => s.gains[k]).map((k) => ({
                key: k,
                label: `${short(t, k)} +${s.gains[k]}`,
              }));
              const shown = gives
                ? [...gains.filter((g) => g.key === gives), ...gains.filter((g) => g.key !== gives)]
                : gains;
              const extra = shown.length > 3 ? shown.length - 3 : 0;
              return (
                <li key={s.name} className="flex items-start gap-3 px-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="flex flex-wrap gap-1">
                      {shown.slice(0, 3).map((g) => (
                        <span
                          key={g.key}
                          className={cn(
                            "rounded-full border-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            g.key === gives && "bg-accent",
                          )}
                        >
                          {g.label}
                        </span>
                      ))}
                      {extra > 0 && (
                        <span
                          className="text-muted-foreground px-1 py-0.5 text-[11px]"
                          title={shown
                            .slice(3)
                            .map((g) => g.label)
                            .join(", ")}
                        >
                          {t("items.more", { n: extra })}
                        </span>
                      )}
                      {s.gains.du ? (
                        <span className="rounded-full border-2 border-dashed px-2 py-0.5 text-[11px] font-semibold">
                          {t("stat.short.du")} +{s.gains.du}
                        </span>
                      ) : null}
                      {s.ability && (
                        <span className="bg-secondary/20 rounded-full border-2 px-2 py-0.5 text-[11px] font-semibold">
                          {t(`ability.${s.ability}` as const)}
                        </span>
                      )}
                    </span>
                    {a.kind === "buyable" && (
                      <span className="text-muted-foreground truncate text-xs">
                        {a.shops.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-xs tabular-nums">
                    {a.kind === "buyable" ? (
                      <>
                        <span className="font-semibold">
                          {t("items.gilda", { n: a.price.toLocaleString("en") })}
                        </span>
                        <span className="text-muted-foreground">
                          {t("items.fromChapter", { n: a.fromChapter })}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-full border-2 border-dashed px-2 py-0.5 font-semibold">
                        {t("items.foundOnly")}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
