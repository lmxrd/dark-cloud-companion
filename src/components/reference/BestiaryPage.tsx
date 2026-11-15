import { useEffect, useMemo, useState } from "react";
import { useTranslations, type Translate } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { loadEnemies, type Enemy } from "@/lib/gamedata";
import {
  chapterOfSection,
  Chip,
  Chips,
  Detail,
  Empty,
  matches,
  nameOf,
  Section,
  Segments,
  StickyBar,
} from "./kit";

const TYPES = ["all", "normal", "sub-boss", "boss", "mimic"] as const;
type TypeFilter = (typeof TYPES)[number];

/** Damage taken per weapon kind and attribute, as the enemy table has them. */
const EFFECTIVENESS = [
  ["effectivenessWrench", "wrench"],
  ["effectivenessSword", "sword"],
  ["effectivenessGun", "gun"],
  ["effectivenessBeam", "beam"],
  ["effectivenessGrenade", "grenade"],
  ["effectivenessMagic", "magic"],
  ["effectivenessRidepod", "ridepod"],
  ["effectivenessFlame", "fl"],
  ["effectivenessChill", "ch"],
  ["effectivenessLightning", "li"],
  ["effectivenessCyclone", "cy"],
  ["effectivenessSmash", "sm"],
  ["effectivenessExorcism", "ex"],
  ["effectivenessBeast", "be"],
  ["effectivenessScale", "sc"],
] as const;

type DamageKey = (typeof EFFECTIVENESS)[number][1];
const STAT_DAMAGE = ["fl", "ch", "li", "cy", "sm", "ex", "be", "sc"] as const;
type StatDamage = (typeof STAT_DAMAGE)[number];
const isStat = (k: DamageKey): k is StatDamage => (STAT_DAMAGE as readonly string[]).includes(k);
const damageLabel = (t: Translate, key: DamageKey) =>
  isStat(key)
    ? t(`stat.${key}` as const)
    : t(`bestiary.damage.${key as Exclude<DamageKey, StatDamage>}` as const);

/** Every enemy: stats, weaknesses, drops and where it appears (the bestiary loads on demand). */
export function BestiaryPage() {
  const t = useTranslations();
  const [enemies, setEnemies] = useState<Enemy[]>();
  const [type, setType] = useQueryChoice<TypeFilter>("type", TYPES, "all");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();
  useEffect(() => {
    let live = true;
    void loadEnemies().then((d) => live && setEnemies(d.enemies));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(
    () =>
      (enemies ?? [])
        .filter((e) => type === "all" || e.type === type)
        .filter((e) =>
          matches(
            needle,
            e.name,
            e.variantLabel,
            nameOf("monsterClasses", e.classId),
            ...e.drops.map((d) => nameOf("items", d.itemId)),
            ...e.sections.map((s) => nameOf("sections", s.sectionId)),
          ),
        )
        .sort(
          (a, b) => (a.notesNumber ?? 999) - (b.notesNumber ?? 999) || a.name.localeCompare(b.name),
        ),
    [enemies, type, needle],
  );

  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("bestiary.search")} value={q} onChange={setQ}>
        <Segments
          label={t("bestiary.type")}
          value={type}
          onChange={setType}
          options={TYPES.map((v) => ({ value: v, label: t(`bestiary.type.${v}` as const) }))}
        />
      </StickyBar>
      {!enemies ? (
        <p className="text-muted-foreground text-sm">{t("reference.loading")}</p>
      ) : shown.length === 0 ? (
        <Empty>{t("reference.noMatch")}</Empty>
      ) : (
        <Section title={t("nav.bestiary")} meta={t("reference.count", { n: shown.length })}>
          {shown.map((e) => (
            <EnemyRow key={e.id} enemy={e} />
          ))}
        </Section>
      )}
    </Gate>
  );
}

function EnemyRow({ enemy: e }: { enemy: Enemy }) {
  const t = useTranslations();
  const weak = EFFECTIVENESS.filter(([k]) => (e[k] ?? 100) > 100);
  const strong = EFFECTIVENESS.filter(([k]) => (e[k] ?? 100) < 100);
  const fmt = (n: number | null | undefined) => (n == null ? "?" : n.toLocaleString("en"));
  return (
    <li className="px-3 py-2">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">
              {e.notesNumber != null && (
                <span className="text-muted-foreground mr-1.5 tabular-nums">#{e.notesNumber}</span>
              )}
              {e.name}
              {e.variantLabel && (
                <span className="text-muted-foreground font-normal"> · {e.variantLabel}</span>
              )}
            </span>
            <Detail>
              {[
                e.type !== "normal" && t(`bestiary.type.${e.type}` as const),
                nameOf("monsterClasses", e.classId),
                t("bestiary.stats", { hp: fmt(e.hp), at: fmt(e.attack), df: fmt(e.defense) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Detail>
          </span>
          <span className="flex shrink-0 flex-col items-end text-xs tabular-nums">
            {!!e.abs && (
              <span className="font-semibold">{t("bestiary.abs", { n: fmt(e.abs) })}</span>
            )}
            {!!e.gilda && (
              <span className="text-muted-foreground">{t("items.gilda", { n: fmt(e.gilda) })}</span>
            )}
          </span>
        </summary>
        <div className="mt-2 flex flex-col gap-1.5">
          {(weak.length > 0 || strong.length > 0) && (
            <Chips>
              {weak.map(([k, key]) => (
                <Chip key={k} tone="good">
                  {damageLabel(t, key)} {e[k]}%
                </Chip>
              ))}
              {strong.map(([k, key]) => (
                <Chip key={k} tone="bad">
                  {damageLabel(t, key)} {e[k]}%
                </Chip>
              ))}
            </Chips>
          )}
          {e.drops.length > 0 && (
            <Detail>
              {e.drops
                .map(
                  (d) =>
                    `${nameOf("items", d.itemId)} (${t(`bestiary.drop.${d.method ?? "drop"}` as const)})`,
                )
                .join(", ")}
            </Detail>
          )}
          {e.sections.length > 0 && (
            <Detail>
              {t("bestiary.foundIn")}{" "}
              {e.sections
                .map(
                  (s) =>
                    `${nameOf("sections", s.sectionId)} (${t("reference.chapterShort", {
                      n: chapterOfSection(s.sectionId) ?? "?",
                    })}${s.count > 1 ? ` · ×${s.count}` : ""}${s.starArea ? ` · ${t("bestiary.starArea")}` : ""})`,
                )
                .join(", ")}
            </Detail>
          )}
          {weak.length + strong.length === 0 && e.drops.length === 0 && e.sections.length === 0 && (
            <Detail>{t("bestiary.noDetail")}</Detail>
          )}
        </div>
      </details>
    </li>
  );
}
