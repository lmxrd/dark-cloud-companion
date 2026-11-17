import type { ReactNode } from "react";
import { useTranslations } from "@/i18n";
import { STAT_KEYS } from "@/lib/schemas";
import type { Weapon } from "@/lib/gamedata/types";
import { names, trophiesFor, weapons } from "@/lib/db/data";
import { dbHref } from "@/lib/db/routes";
import { weaponById, weaponData } from "@/lib/planner/sources";
import { finalWeaponIds } from "@/lib/planner/graph";
import { weaponGuides } from "@/lib/guide/builtin";
import { familyOf } from "@/lib/weapons/map";
import { BuildUpMap } from "@/components/weapons/BuildUpMap";
import { cn } from "cn";
import {
  Chip,
  Chips,
  DetailBlock,
  DetailPage,
  DetailSection,
  Detail,
  Hero,
  Ref,
  Row,
} from "../kit";
import { SectionRef, sourceRows } from "../sources";

/** A weapon: stats, its build-up line, what to kill first, where to get it and who uses it. */
export function WeaponPage({
  weapon: w,
  actions,
  absRange,
}: {
  weapon: Weapon;
  actions?: ReactNode;
  /** The ABS calculator (an island). */
  absRange?: ReactNode;
}) {
  const t = useTranslations();
  const pw = weaponById.get(w.id)!;
  const isFinal = finalWeaponIds.includes(w.id);
  const scale = Math.max(1, ...STAT_KEYS.map((k) => pw.maxStats[k]));
  // Everything this weapon is built from or into, on one map.
  const mapWeapons = weaponData.weapons.map((x) => ({
    id: x.id,
    tier: x.tier ?? 1,
    buildsInto: x.buildsUpTo,
  }));
  const related = familyOf(w.id, mapWeapons);
  const family = weaponData.weapons.filter((x) => related.has(x.id));
  const guides = weaponGuides.filter((g) =>
    g.steps.some((s) => s.build?.weaponId === w.id || s.buildUp?.weaponId === w.id),
  );
  const trophies = trophiesFor.weapon.get(w.id) ?? [];

  return (
    <DetailPage>
      <Hero
        kinds={[
          <span
            className={cn(
              "-mx-2 rounded-full px-2",
              w.character === "max" ? "bg-primary" : "bg-secondary",
            )}
          >
            {t(`weapons.${w.character}` as const)}
          </span>,
          t(`weapon.type.${w.type}` as const),
          isFinal && `★ ${t("weapons.final")}`,
        ].filter(Boolean)}
        title={w.name}
        description={w.description}
        facts={[
          { label: t("db.tier"), value: w.tier },
          { label: t("weapons.baseAbs"), value: w.baseAbs },
          { label: t("weapons.spPerLevel"), value: w.synthPointsPerLevel },
          w.combo && { label: t("weapons.combo"), value: w.combo },
          { label: t("weapons.durability"), value: `≤ ${w.maxDurability}` },
        ]}
        actions={actions}
      >
        <Chips>
          {w.abilities.length ? (
            w.abilities.map((a) => (
              <Chip key={a} tone="accent">
                <Ref href={dbHref("ability", a)}>{names.abilities[a]}</Ref>
              </Chip>
            ))
          ) : (
            <Detail>{t("db.noAbilities")}</Detail>
          )}
          {pw.gunType && (
            <Chip tone="dashed">
              {t("weapons.gunType")}: {pw.gunType}
            </Chip>
          )}
        </Chips>
        {pw.attackVariesByTime && <Detail>{t("weapons.attackVaries")}</Detail>}
      </Hero>

      <DetailBlock title={t("weapons.statsTitle")}>
        <ul className="bg-card flex flex-col gap-2 rounded-lg border-2 p-3">
          {STAT_KEYS.map((k) => (
            <li key={k} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-sm">
              <span className="text-muted-foreground truncate text-xs font-semibold">
                {t(`stat.${k}` as const)}
              </span>
              <span className="bg-muted relative h-3 rounded-full" aria-hidden>
                <span
                  className="border-border absolute inset-y-0 left-0 rounded-full border-2 border-dashed"
                  style={{ width: `${(100 * pw.maxStats[k]) / scale}%` }}
                />
                <span
                  className="bg-primary absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(100 * pw.baseStats[k]) / scale}%` }}
                />
              </span>
              <span className="text-right text-xs tabular-nums">
                <b>{pw.baseStats[k]}</b> / {pw.maxStats[k]}
              </span>
            </li>
          ))}
        </ul>
      </DetailBlock>

      <DetailBlock title={t("db.buildUpMap")} meta={t("db.buildUpMapMeta")}>
        <BuildUpMap weapons={family} current={w.id} label={t("db.buildUpMap")} />
      </DetailBlock>

      <DetailSection
        title={t("db.killFirst")}
        rows={w.killRequirements.map((id) => (
          <Row
            key={id}
            title={<Ref href={dbHref("enemy", id)}>{names.enemies[id]}</Ref>}
            aside={t("reference.chapterShort", { n: weapons.killEnemyChapters[id] ?? "?" })}
          >
            {weapons.killEnemySections[id] && (
              <Detail>
                {t("db.firstOn")} <SectionRef id={weapons.killEnemySections[id]} />
              </Detail>
            )}
          </Row>
        ))}
      />

      <DetailSection
        title={t("db.whereToGet")}
        rows={sourceRows(t, { ...w.sources, buildUpFrom: undefined })}
      />

      {absRange && <DetailBlock title={t("db.absTitle")}>{absRange}</DetailBlock>}

      <DetailSection
        title={t("db.inGuides")}
        rows={guides.map((g) => (
          <Row
            key={g.id}
            title={<Ref href={`/guides/view?id=${encodeURIComponent(g.id)}`}>{g.title}</Ref>}
          />
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
