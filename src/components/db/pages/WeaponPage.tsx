import type { ReactNode } from "react";
import { useTranslations } from "@/i18n";
import { STAT_KEYS } from "@/lib/schemas";
import type { Weapon } from "@/lib/gamedata/types";
import { builtFrom, names, trophiesFor, weapons } from "@/lib/db/data";
import { dbHref } from "@/lib/db/routes";
import { weaponById } from "@/lib/planner/sources";
import { finalWeaponIds } from "@/lib/planner/graph";
import { weaponGuides } from "@/lib/guide/builtin";
import { lineTo } from "@/lib/weapons/info";
import { withBase } from "@/lib/base";
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
  const line = lineTo(w.id);
  const hidden = line.length > 5 ? line.length - 4 : 0;
  const shownLine = hidden ? [line[0], null, ...line.slice(-3)] : line;
  const parents = builtFrom.get(w.id) ?? [];
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

      <DetailBlock title={t("weapons.lineTitle")}>
        <ol className="relative flex flex-col gap-2 pl-7">
          <span aria-hidden className="bg-border absolute top-2 bottom-2 left-[9px] w-0.5" />
          {shownLine.map((x, i) =>
            x === null ? (
              <li key="more" className="text-muted-foreground relative text-xs">
                <span
                  aria-hidden
                  className="bg-background absolute top-0.5 -left-[22px] size-3 rounded-full border-2 border-dashed"
                />
                {t("weapons.lineMore", { n: hidden })}
              </li>
            ) : (
              <li key={x.id + i} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1 -left-7 size-5 rounded-full border-2",
                    x.id === w.id ? "bg-accent" : "bg-background",
                  )}
                />
                {x.id === w.id ? (
                  <span className="font-heading font-extrabold" aria-current="page">
                    {x.name}
                  </span>
                ) : (
                  <Ref href={dbHref("weapon", x.id)} className="text-sm">
                    {x.name}
                  </Ref>
                )}
              </li>
            ),
          )}
          {w.buildsInto.length > 0 && (
            <li className="relative flex flex-col gap-1">
              <span
                aria-hidden
                className="bg-background absolute top-1 -left-7 size-5 rounded-full border-2 border-dashed"
              />
              <span className="text-muted-foreground text-xs">{t("weapons.buildsInto")}</span>
              <span className="flex flex-wrap gap-1.5">
                {w.buildsInto.map((id) => (
                  <a
                    key={id}
                    className="bg-card hover:bg-accent rounded-full border-2 px-2.5 py-0.5 text-sm font-semibold"
                    href={withBase(dbHref("weapon", id))}
                  >
                    {finalWeaponIds.includes(id) ? "★ " : ""}
                    {names.weapons[id]}
                  </a>
                ))}
              </span>
            </li>
          )}
        </ol>
        {parents.length > 1 && (
          <Detail>
            {t("db.alsoBuiltFrom")}{" "}
            {parents.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <Ref href={dbHref("weapon", p.id)}>{p.name}</Ref>
              </span>
            ))}
          </Detail>
        )}
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
