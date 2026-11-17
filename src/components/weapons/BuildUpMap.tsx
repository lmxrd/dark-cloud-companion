import { useMemo, useState, type MouseEvent } from "react";
import { cn } from "cn";
import { useTranslations } from "@/i18n";
import { withBase } from "@/lib/base";
import { dbHref } from "@/lib/db/routes";
import { finalWeaponIds } from "@/lib/planner/graph";
import type { Weapon } from "@/lib/schemas";
import { familyOf, layoutMap } from "@/lib/weapons/map";

/** The app's stat order on cards: At, Du, Fl, Ch, Li, Cy, Sm, Ex, Be, Sc. */
export const CARD_STATS = ["at", "du", "fl", "ch", "li", "cy", "sm", "ex", "be", "sc"] as const;
export type CardStat = (typeof CARD_STATS)[number];

const COL = 222;
const ROW = 128;
const CARD_W = 186;
const PAD_X = 12;
const PAD_Y = 34;
/** Where arrows meet a card: level with its header. */
const ARROW_Y = 15;

/** Two stats per row: `| At 21/35 | Du 0/35 |`. */
export function StatPairs({
  values,
  className,
}: {
  values: (k: CardStat) => { text: React.ReactNode; zero: boolean };
  className?: string;
}) {
  const t = useTranslations();
  const rows: CardStat[][] = [];
  for (let i = 0; i < CARD_STATS.length; i += 2) rows.push([CARD_STATS[i], CARD_STATS[i + 1]]);
  return (
    <table
      className={cn("w-full table-fixed border-collapse text-[11.5px] tabular-nums", className)}
    >
      <tbody>
        {rows.map((pair) => (
          <tr key={pair[0]} className="odd:bg-muted/55">
            {pair.map((k, i) => {
              const v = values(k);
              return (
                <td
                  key={k}
                  className={cn(
                    "px-1.5 py-px whitespace-nowrap",
                    i === 1 && "border-border/25 border-l-[1.5px]",
                    v.zero && "text-muted-foreground/60",
                  )}
                >
                  <span className="text-muted-foreground inline-block w-[18px] font-bold">
                    {t(`stat.short.${k}` as const)}
                  </span>{" "}
                  {v.text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const base = (w: Weapon, k: CardStat) => (k === "du" ? 0 : w.baseStats[k]);
const max = (w: Weapon, k: CardStat) => (k === "du" ? w.maxDu : w.maxStats[k]);

/** One weapon on the map: name, abilities and every stat as base/max. */
function WeaponCard({
  w,
  state,
  onClick,
  style,
}: {
  w: Weapon;
  state: "plain" | "on" | "dim" | "current";
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  style: React.CSSProperties;
}) {
  const t = useTranslations();
  const final = finalWeaponIds.includes(w.id);
  return (
    <a
      href={withBase(dbHref("weapon", w.id))}
      onClick={onClick}
      style={style}
      aria-current={state === "current" ? "page" : undefined}
      className={cn(
        "bg-card text-card-foreground shadow-sticker-sm absolute block overflow-hidden rounded-[10px] border-2 transition-opacity",
        final && "border-[3px]",
        (state === "on" || state === "current") && "outline-accent outline-3 outline-offset-1",
        state === "dim" && "opacity-30",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-between gap-1 border-b-2 px-2 py-1 text-xs leading-tight font-bold",
          final
            ? "bg-accent text-accent-foreground"
            : w.character === "max"
              ? "bg-primary/30"
              : "bg-secondary/35",
        )}
      >
        <span className="truncate">
          {final && "★ "}
          {w.name}
        </span>
        {w.abilities.length > 0 && (
          <span className="flex shrink-0 gap-0.5">
            {w.abilities.map((a) => (
              <span
                key={a}
                title={t(`ability.${a}` as const)}
                className="bg-card text-card-foreground rounded-full border-[1.5px] px-1 text-[9px] font-bold"
              >
                {t(`db.abilityShort.${a}` as const)}
              </span>
            ))}
          </span>
        )}
      </span>
      <StatPairs
        values={(k) => {
          const b = base(w, k);
          const m = max(w, k);
          return {
            text: (
              <>
                {b}
                <b className={cn(!b && !m && "font-normal")}>/{m}</b>
              </>
            ),
            zero: !b && !m,
          };
        }}
      />
    </a>
  );
}

/**
 * A build-up map: columns are tiers, arrows are build-ups, each weapon a card with its stats.
 * `interactive`: tapping a card lights up everything it is built from and into; tapping it again
 * opens it. `current`: the weapon whose page this is. `matches`: weapons a search found (the rest
 * are dimmed).
 */
export function BuildUpMap({
  weapons,
  current,
  interactive = false,
  matches,
  label,
}: {
  weapons: Weapon[];
  current?: string;
  interactive?: boolean;
  matches?: Set<string>;
  label: string;
}) {
  const t = useTranslations();
  const mapWeapons = useMemo(
    () => weapons.map((w) => ({ id: w.id, tier: w.tier ?? 1, buildsInto: w.buildsUpTo })),
    [weapons],
  );
  const layout = useMemo(() => layoutMap(mapWeapons), [mapWeapons]);
  const [selected, setSelected] = useState<string>();
  const family = useMemo(
    () => (selected ? familyOf(selected, mapWeapons) : undefined),
    [selected, mapWeapons],
  );
  const lit = family ?? (matches?.size ? matches : undefined);
  const width = layout.cols * COL - (COL - CARD_W) + PAD_X * 2;
  const height = layout.rows * ROW + PAD_Y;
  const at = (id: string) => {
    const p = layout.pos.get(id)!;
    return { x: PAD_X + p.col * COL, y: PAD_Y + p.row * ROW };
  };

  return (
    <div className="bg-card overflow-x-auto rounded-lg border-2 p-1.5">
      <div role="group" aria-label={label} className="relative" style={{ width, height }}>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(undefined)}
            className="bg-card shadow-sticker-sm absolute top-0 left-1 z-10 rounded-md border-2 px-2 py-0.5 text-xs font-semibold"
          >
            {t("db.mapShowAll")}
          </button>
        )}
        {Array.from({ length: layout.cols }, (_, c) => (
          <span
            key={c}
            className="text-muted-foreground absolute top-1.5 text-center text-[11px] font-extrabold tracking-wider uppercase"
            style={{ left: PAD_X + c * COL, width: CARD_W }}
          >
            {t("db.tierN", { n: layout.minTier + c })}
          </span>
        ))}
        <svg className="absolute inset-0" width={width} height={height} aria-hidden>
          {layout.edges.map(({ from, to }) => {
            const a = at(from);
            const b = at(to);
            const x1 = a.x + CARD_W;
            const y1 = a.y + ARROW_Y;
            const x2 = b.x;
            const y2 = b.y + ARROW_Y;
            const mx = (x1 + x2) / 2;
            const on = !!lit && lit.has(from) && lit.has(to);
            const dim = !!lit && !on;
            return (
              <g
                key={`${from}-${to}`}
                className={cn(
                  "fill-none",
                  on ? "stroke-foreground" : "stroke-muted-foreground",
                  dim && "opacity-15",
                )}
                strokeWidth={on ? 2.6 : 1.6}
              >
                <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 7},${y2}`} />
                <path d={`M${x2 - 8},${y2 - 5} L${x2},${y2} L${x2 - 8},${y2 + 5}`} />
              </g>
            );
          })}
        </svg>
        {weapons.map((w) => {
          const { x, y } = at(w.id);
          const state =
            w.id === current ? "current" : lit ? (lit.has(w.id) ? "on" : "dim") : "plain";
          return (
            <WeaponCard
              key={w.id}
              w={w}
              state={state}
              style={{ left: x, top: y, width: CARD_W }}
              onClick={
                interactive
                  ? (e) => {
                      // The first tap lights up the family; tapping the same card again opens it.
                      if (selected !== w.id) {
                        e.preventDefault();
                        setSelected(w.id);
                      }
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
