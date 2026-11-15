import { useTranslations } from "@/i18n";
import type { Enemy } from "@/lib/gamedata/types";
import { byId, killRequiredBy, monsterUnlocksWithEnemy, names, trophiesFor } from "@/lib/db/data";
import { dbHref } from "@/lib/db/routes";
import { Chip, Chips, DetailPage, DetailSection, Detail, Hero, Ref, Row } from "../kit";
import { SectionRef } from "../sources";

/** Damage taken per weapon kind and attribute, as the enemy table has them. */
export const EFFECTIVENESS = [
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
export const damageLabel = (t: ReturnType<typeof useTranslations>, key: DamageKey) =>
  isStat(key)
    ? t(`stat.${key}` as const)
    : t(`bestiary.damage.${key as Exclude<DamageKey, StatDamage>}` as const);

const fmt = (n: number | null | undefined) => (n == null ? "?" : n.toLocaleString("en"));

/** An enemy: stats, what hurts it, which build-ups need it killed, drops and where it is. */
export function EnemyPage({ enemy: e }: { enemy: Enemy }) {
  const t = useTranslations();
  const eff = EFFECTIVENESS.filter(([k]) => (e[k] ?? 100) !== 100).sort(
    ([a], [b]) => (e[b] ?? 100) - (e[a] ?? 100),
  );
  const needs = killRequiredBy.get(e.id) ?? [];
  const unlocks = monsterUnlocksWithEnemy.get(e.id) ?? [];
  const trophies = trophiesFor.enemy.get(e.id) ?? [];
  const variants = [...byId.enemy.values()].filter(
    (x) =>
      x.id !== e.id &&
      (x.variantOfId === e.id ||
        (e.variantOfId && (x.id === e.variantOfId || x.variantOfId === e.variantOfId))),
  );
  return (
    <DetailPage>
      <Hero
        kinds={[
          e.notesNumber != null && `#${e.notesNumber}`,
          e.type !== "normal" && t(`bestiary.type.${e.type}` as const),
          e.classId && (
            <Ref href={dbHref("monsterClass", e.classId)}>{names.monsterClasses[e.classId]}</Ref>
          ),
          e.variantLabel,
        ].filter(Boolean)}
        title={e.name}
        facts={[
          { label: t("db.hp"), value: fmt(e.hp) },
          { label: t("stat.at"), value: fmt(e.attack) },
          { label: t("db.defense"), value: fmt(e.defense) },
          !!e.abs && { label: t("db.abs"), value: fmt(e.abs) },
          !!e.gilda && { label: t("db.gilda"), value: fmt(e.gilda) },
        ]}
      >
        {eff.length > 0 && (
          <div className="flex flex-col gap-1">
            <Detail>{t("db.damageTaken")}</Detail>
            <Chips>
              {eff.map(([k, key]) => (
                <Chip key={k} tone={(e[k] ?? 100) > 100 ? "good" : "bad"}>
                  {damageLabel(t, key)} {e[k]}%
                </Chip>
              ))}
            </Chips>
          </div>
        )}
        {e.photoId && (
          <Detail>
            {t("db.photo")}: <Ref href={dbHref("photo", e.photoId)}>{names.photos[e.photoId]}</Ref>
          </Detail>
        )}
      </Hero>
      <DetailSection
        title={t("db.killToBuild")}
        rows={needs.map((w) => (
          <Row key={w.id} title={<Ref href={dbHref("weapon", w.id)}>{w.name}</Ref>}>
            <Detail>
              {t(`weapons.${w.character}` as const)} · {t(`weapon.type.${w.type}` as const)}
            </Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.drops")}
        rows={e.drops.map((d) => (
          <Row
            key={`${d.itemId}-${d.method}`}
            title={<Ref href={dbHref("item", d.itemId)}>{names.items[d.itemId]}</Ref>}
            aside={<Chip tone="dashed">{t(`bestiary.drop.${d.method ?? "drop"}` as const)}</Chip>}
          />
        ))}
      />
      <DetailSection
        title={t("db.foundOn")}
        rows={e.sections.map((s) => {
          const sec = byId.section.get(s.sectionId);
          return (
            <Row key={s.sectionId} title={<SectionRef id={s.sectionId} />} aside={`×${s.count}`}>
              <Detail>
                {[
                  sec?.dungeonId && names.dungeons[sec.dungeonId],
                  t("reference.chapterShort", { n: sec?.chapterNumber ?? "?" }),
                  s.starArea && t("bestiary.starArea"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Detail>
            </Row>
          );
        })}
      />
      <DetailSection
        title={t("db.monsterUnlocks")}
        rows={unlocks.map((u) => (
          <Row
            key={u.id}
            title={
              <Ref href={dbHref("monsterClass", u.classId)}>{names.monsterClasses[u.classId]}</Ref>
            }
          >
            <Detail>
              {t(`db.unlock.${u.method}` as const, { n: u.quantity ?? 1, enemy: e.name })}{" "}
              <Ref href={dbHref("item", u.itemId)}>{names.items[u.itemId]}</Ref>
            </Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.variants")}
        rows={variants.map((v) => (
          <Row key={v.id} title={<Ref href={dbHref("enemy", v.id)}>{v.name}</Ref>}>
            {v.variantLabel && <Detail>{v.variantLabel}</Detail>}
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.trophies")}
        rows={trophies.map((x) => (
          <Row key={x.id} title={x.name} aside={<Chip>{t(`trophy.${x.tier}` as const)}</Chip>}>
            <Detail>{x.description}</Detail>
          </Row>
        ))}
      />
    </DetailPage>
  );
}
