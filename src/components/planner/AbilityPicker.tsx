import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import type { AbilityId } from "@/lib/schemas";
import { HelpPopover } from "@/components/ui/help-popover";
import { weapons } from "@/lib/gamedata/weapons";

/** The four pairs that exclude each other, left / right. */
const PAIRS: [AbilityId, AbilityId][] = [
  ["wealth", "poverty"],
  ["critical", "dark"],
  ["durable", "fragile"],
  ["absorb", "heal"],
];
/** Abilities without an opposite. */
const SINGLES: AbilityId[] = ["steal", "stop", "poison", "abs-up"];
/** The usual endgame set. */
const BEST: AbilityId[] = [
  "poison",
  "stop",
  "abs-up",
  "steal",
  "wealth",
  "dark",
  "durable",
  "absorb",
];

/**
 * A native input stretched over its tile, so the whole tile is the hit target and the input keeps
 * its label, keyboard handling and form semantics.
 */
const overlay =
  "peer absolute inset-0 z-10 cursor-pointer appearance-none rounded-[inherit] outline-none";
const tile =
  "relative grid min-h-10 place-items-center px-1 text-center text-xs font-semibold leading-tight peer-checked:bg-accent";

/**
 * Abilities for the finished weapon: each opposing pair is a three-way switch (left, none, right),
 * the standalone abilities are four equal toggle tiles.
 */
export function AbilityPicker({
  abilities,
  onChange,
}: {
  abilities: AbilityId[];
  onChange: (a: AbilityId[]) => void;
}) {
  const t = useTranslations();
  const has = (a: AbilityId) => abilities.includes(a);
  const setPair = (pair: [AbilityId, AbilityId], pick: AbilityId | null) =>
    onChange([...abilities.filter((a) => !pair.includes(a)), ...(pick ? [pick] : [])]);
  const toggle = (a: AbilityId, on: boolean) =>
    onChange(on ? [...abilities, a] : abilities.filter((x) => x !== a));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t("planner.wantAbilities")}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="text-sm font-semibold">
            {t("planner.wantAbilities")}
          </span>
          <HelpPopover label={t("planner.abilitiesHelp")}>
            <AbilityHelp />
          </HelpPopover>
        </span>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="xs" onClick={() => onChange(BEST)}>
            {t("planner.abilitiesPreset")}
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange([])}>
            {t("planner.abilitiesClear")}
          </Button>
        </div>
      </div>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {PAIRS.map((pair) => {
          const [left, right] = pair;
          const name = `ability-${left}-${right}`;
          const options: { value: AbilityId | null; label: string; aria?: string }[] = [
            { value: left, label: t(`ability.${left}` as const) },
            {
              value: null,
              label: t("planner.abilityNone"),
              aria: t("planner.abilityNeither", {
                a: t(`ability.${left}` as const),
                b: t(`ability.${right}` as const),
              }),
            },
            { value: right, label: t(`ability.${right}` as const) },
          ];
          const current = has(left) ? left : has(right) ? right : null;
          return (
            <div
              key={name}
              role="radiogroup"
              aria-label={`${t(`ability.${left}` as const)} / ${t(`ability.${right}` as const)}`}
              className="grid grid-cols-[1fr_2.5rem_1fr] overflow-hidden rounded-md border-2"
            >
              {options.map((o) => (
                <label
                  key={o.value ?? "none"}
                  className="relative border-r-2 last:border-r-0 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset"
                >
                  <input
                    type="radio"
                    name={name}
                    className={overlay}
                    checked={current === o.value}
                    onChange={() => setPair(pair, o.value)}
                    aria-label={o.aria ?? o.label}
                  />
                  <span
                    className={cn(
                      tile,
                      o.value === null && "text-muted-foreground peer-checked:bg-muted",
                    )}
                  >
                    {o.label}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
      <span className="text-muted-foreground mt-1 text-xs">{t("planner.abilitiesAlso")}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {SINGLES.map((a) => (
          <label
            key={a}
            className="relative rounded-md border-2 has-checked:shadow-sticker-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="checkbox"
              className={overlay}
              checked={has(a)}
              onChange={(e) => toggle(a, e.target.checked)}
              aria-label={t(`ability.${a}` as const)}
            />
            <span className={cn(tile, "rounded-[inherit]")}>{t(`ability.${a}` as const)}</span>
          </label>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{t("planner.abilitiesHint")}</p>
    </fieldset>
  );
}

/** What each ability does (from the game data), opposing pairs side by side. */
function AbilityHelp() {
  const t = useTranslations();
  const byId = new Map(weapons.abilities.map((a) => [a.id, a]));
  const line = (id: AbilityId) => {
    const a = byId.get(id);
    return a ? (
      <span key={id} className="block">
        <span className="font-semibold">{a.name}</span>: {a.description}
      </span>
    ) : null;
  };
  return (
    <span className="flex flex-col gap-2">
      <span className="block">{t("planner.abilitiesHelpIntro")}</span>
      {PAIRS.map(([l, r]) => (
        <span key={l} className="bg-muted/50 block rounded p-1.5">
          {line(l)}
          {line(r)}
        </span>
      ))}
      {SINGLES.map(line)}
    </span>
  );
}
