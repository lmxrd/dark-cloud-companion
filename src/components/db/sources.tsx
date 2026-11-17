// "Where to get it": every way to get an item, weapon or Ridepod part, as linked rows. Server only.
import type { ReactNode } from "react";
import type { Sources } from "@/lib/gamedata/types";
import { useTranslations } from "@/i18n";
import { byId, chapterOf, collectables, names } from "@/lib/db/data";
import { dbHref, sectionHref } from "@/lib/db/routes";
import { Detail, Ref, Row } from "./kit";

/** A link to a section: its floor page, or its chapter. */
export function SectionRef({ id }: { id: string }) {
  const s = byId.section.get(id);
  return s ? <Ref href={sectionHref(s)}>{s.title}</Ref> : <>{id}</>;
}

/** Up to `max` links, then "+n more". */
export function LinkList({ links, max = 4 }: { links: ReactNode[]; max?: number }) {
  const t = useTranslations();
  return (
    <span className="flex flex-wrap items-baseline gap-x-1">
      {links.slice(0, max).map((l, i) => (
        <span key={i}>
          {l}
          {i < Math.min(max, links.length) - 1 ? "," : ""}
        </span>
      ))}
      {links.length > max && (
        <span className="text-muted-foreground text-xs font-normal">
          {t("db.andMore", { n: links.length - max })}
        </span>
      )}
    </span>
  );
}

const currency = (t: ReturnType<typeof useTranslations>, shopId: string, n: number) =>
  t(`shops.currency.${byId.shop.get(shopId)?.currency ?? "gilda"}` as const, {
    n: n.toLocaleString("en"),
  });

/** One row per way to get something. */
export function sourceRows(t: ReturnType<typeof useTranslations>, s: Sources): ReactNode[] {
  const rows: ReactNode[] = [];
  for (const l of s.shops ?? []) {
    const shop = byId.shop.get(l.shopId);
    rows.push(
      <Row
        key={`shop-${l.shopId}`}
        tag={t("db.src.shop")}
        title={<Ref href={dbHref("shop", l.shopId)}>{names.shops[l.shopId]}</Ref>}
        aside={l.price != null && <b>{currency(t, l.shopId, l.price)}</b>}
      >
        <Detail>
          {[
            shop?.townId ? names.towns[shop.townId] : t("shops.sellers"),
            (l.fromChapterNumber ?? shop?.fromChapterNumber) &&
              t("reference.fromChapter", { n: l.fromChapterNumber ?? shop!.fromChapterNumber! }),
            l.untilChapterNumber && t("db.untilChapter", { n: l.untilChapterNumber }),
            l.purchaseLimit && t("shops.limit", { n: l.purchaseLimit }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Detail>
      </Row>,
    );
  }
  for (const id of s.inventions ?? []) {
    const inv = byId.invention.get(id);
    rows.push(
      <Row
        key={`inv-${id}`}
        tag={t("db.src.invention")}
        title={<Ref href={dbHref("invention", id)}>{names.inventions[id]}</Ref>}
        aside={inv?.chapterNumber && t("reference.chapterShort", { n: inv.chapterNumber })}
      />,
    );
  }
  if (s.drops?.length)
    rows.push(
      <Row
        key="drops"
        tag={t("db.src.drop")}
        title={
          <LinkList
            links={s.drops.map((d) => (
              <>
                <Ref href={dbHref("enemy", d.enemyId)}>{names.enemies[d.enemyId]}</Ref>
                {d.method && d.method !== "drop" && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({t(`bestiary.drop.${d.method}` as const)})
                  </span>
                )}
              </>
            ))}
          />
        }
      >
        <Detail>{t("db.enemies", { n: s.drops.length })}</Detail>
      </Row>,
    );
  const pickups = (s.pickups ?? []).map((id) => byId.pickup.get(id)).filter((p) => !!p);
  if (pickups.length)
    rows.push(
      <Row
        key="pickups"
        tag={t("db.src.pickup")}
        title={
          <LinkList
            links={pickups.map((p) =>
              p.sectionId ? (
                <SectionRef id={p.sectionId} />
              ) : p.townId ? (
                <Ref href={dbHref("town", p.townId)}>{names.towns[p.townId]}</Ref>
              ) : (
                t("reference.chapterShort", { n: p.chapterNumber ?? "?" })
              ),
            )}
          />
        }
      >
        <Detail>
          {t("db.pickups", { n: pickups.length })}
          {pickups.some((p) => p.missable) ? ` · ${t("db.someMissable")}` : ""}
        </Detail>
      </Row>,
    );
  for (const d of s.dungeons ?? [])
    rows.push(
      <Row
        key={`dungeon-${d}`}
        tag={t("db.src.chest")}
        title={<Ref href={dbHref("dungeon", d)}>{names.dungeons[d]}</Ref>}
      >
        <Detail>{t("db.randomChests")}</Detail>
      </Row>,
    );
  if (s.sphedaPrizes?.length)
    rows.push(
      <Row
        key="spheda"
        tag={t("db.src.spheda")}
        title={
          <LinkList
            links={s.sphedaPrizes.map((p) => (
              <SectionRef id={p.sectionId} />
            ))}
          />
        }
      >
        <Detail>{t("db.sphedaFloors", { n: s.sphedaPrizes.length })}</Detail>
      </Row>,
    );
  for (const r of s.sectionRewards ?? [])
    rows.push(
      <Row
        key={`reward-${r.sectionId}-${r.character ?? ""}`}
        tag={t("db.src.reward")}
        title={<SectionRef id={r.sectionId} />}
        aside={r.quantity > 1 && `×${r.quantity}`}
      >
        <Detail>
          {[
            r.character && t("db.forCharacter", { who: t(`weapons.${r.character}` as const) }),
            t("reference.chapterShort", { n: chapterOf(r.sectionId) ?? "?" }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Detail>
      </Row>,
    );
  for (const r of s.georamaRewards ?? [])
    rows.push(
      <Row
        key={`georama-${r.townId}`}
        tag={t("db.src.georama")}
        title={<Ref href={dbHref("town", r.townId)}>{names.towns[r.townId]}</Ref>}
      >
        <Detail>{t("db.georamaReward")}</Detail>
      </Row>,
    );
  for (const p of s.contestPrizes ?? []) {
    const c = byId.contest.get(p.contestId);
    const cls = c?.classes.find((x) => x.id === p.classId);
    rows.push(
      <Row
        key={`contest-${p.contestId}-${p.classId ?? 0}-${p.place}-${p.prizeSet}`}
        tag={t("db.src.contest")}
        title={<Ref href="/db/fishing?tab=contests">{c?.name ?? p.contestId}</Ref>}
        aside={p.quantity > 1 && `×${p.quantity}`}
      >
        <Detail>
          {[
            cls?.name,
            t("fishing.place", { n: p.place }),
            p.prizeSet === "first-win" ? t("fishing.firstWin") : t("fishing.pool"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Detail>
      </Row>,
    );
  }
  for (const r of s.monsterRewards ?? [])
    rows.push(
      <Row
        key={`monster-${r.classId}-${r.level}`}
        tag={t("db.src.monster")}
        title={
          <Ref href={dbHref("monsterClass", r.classId)}>{names.monsterClasses[r.classId]}</Ref>
        }
      >
        <Detail>{t("db.monsterLevel", { n: r.level })}</Detail>
      </Row>,
    );
  for (const l of s.photoLevels ?? []) {
    const level = collectables.photoLevels.find((x) => x.level === l);
    rows.push(
      <Row
        key={`photo-${l}`}
        tag={t("db.src.photo")}
        title={<Ref href="/db/inventions?tab=photos">{t("db.photoLevel", { n: l })}</Ref>}
      >
        {level && <Detail>{t("db.photoPoints", { n: level.minimumPoints })}</Detail>}
      </Row>,
    );
  }
  if (s.startingEquipment?.length)
    rows.push(
      <Row key="start" tag={t("db.src.start")} title={t("db.startingEquipment")}>
        <Detail>{s.startingEquipment.map((o) => t(`db.owner.${o}` as const)).join(", ")}</Detail>
      </Row>,
    );
  for (const w of s.buildUpFrom ?? [])
    rows.push(
      <Row
        key={`build-${w}`}
        tag={t("db.src.build")}
        title={<Ref href={dbHref("weapon", w)}>{names.weapons[w]}</Ref>}
      >
        <Detail>{t("db.buildUp")}</Detail>
      </Row>,
    );
  return rows;
}
