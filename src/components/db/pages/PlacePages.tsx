// Towns, dungeons and floors.
import { useTranslations } from "@/i18n";
import type { Dungeon, Section, Town } from "@/lib/gamedata/types";
import {
  byId,
  collectables,
  dungeonsOfTown,
  enemies,
  fishInDungeon,
  fishInTown,
  fishOnFloor,
  floorDetail,
  georama,
  names,
  peopleOfTown,
  photosInTown,
  photosOnFloor,
  pickupsInTown,
  pickupsOnFloor,
  sectionsOfDungeon,
  shopsInTown,
  weaponsInDungeon,
} from "@/lib/db/data";
import { dbHref, productHref } from "@/lib/db/routes";
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
import { SectionRef } from "../sources";
import { withBase } from "@/lib/base";

const time = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const fmt = (n: number) => n.toLocaleString("en");

/** A town: dungeons, shops, people, fishing spots, pickups and its Georama. */
export function TownPage({ town: tw }: { town: Town }) {
  const t = useTranslations();
  const shops = shopsInTown.get(tw.id) ?? [];
  const people = peopleOfTown.get(tw.id) ?? [];
  const dungeons = dungeonsOfTown.get(tw.id) ?? [];
  const fish = fishInTown.get(tw.id) ?? [];
  const pickups = pickupsInTown.get(tw.id) ?? [];
  const photos = photosInTown.get(tw.id) ?? [];
  const tasks = collectables.georamaTasks.filter((x) => x.townId === tw.id);
  const buildable = georama.townParts.filter((x) => x.townId === tw.id);
  const rewards = georama.townRewards.filter((x) => x.townId === tw.id);
  const present = tw.presentTownId ? byId.town.get(tw.presentTownId) : undefined;
  const future = [...byId.town.values()].filter((x) => x.presentTownId === tw.id);
  return (
    <DetailPage>
      <Hero
        kinds={[
          t("db.kind.town"),
          t(`db.era.${tw.era}` as const),
          tw.hasGeorama && t("db.georama"),
        ].filter(Boolean)}
        title={tw.name}
        facts={[
          { label: t("db.shops"), value: shops.length },
          { label: t("nav.people"), value: people.length },
          { label: t("db.dungeons"), value: dungeons.length },
          tw.hasGeorama && { label: t("db.georamaParts"), value: buildable.length },
        ]}
      >
        {(present || future.length > 0) && (
          <Detail>
            {present && (
              <>
                {t("db.futureOf")} <Ref href={dbHref("town", present.id)}>{present.name}</Ref>
              </>
            )}
            {future.map((f) => (
              <span key={f.id}>
                {t("db.becomes")} <Ref href={dbHref("town", f.id)}>{f.name}</Ref>
              </span>
            ))}
          </Detail>
        )}
      </Hero>
      <DetailSection
        title={t("db.dungeons")}
        rows={dungeons.map((d) => (
          <Row
            key={d.id}
            title={<Ref href={dbHref("dungeon", d.id)}>{d.name}</Ref>}
            aside={t("reference.chapterShort", { n: d.chapterNumber ?? "?" })}
          >
            <Detail>{t("db.floorsN", { n: (sectionsOfDungeon.get(d.id) ?? []).length })}</Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.shops")}
        rows={shops.map((s) => (
          <Row
            key={s.id}
            title={<Ref href={dbHref("shop", s.id)}>{s.name}</Ref>}
            aside={t("db.thingsN", { n: s.stock.length })}
          >
            {s.npcId && <Detail>{names.npcs[s.npcId]}</Detail>}
          </Row>
        ))}
      />
      {people.length > 0 && (
        <DetailBlock title={t("nav.people")} meta={people.length}>
          <Chips>
            {people.map((n) => (
              <Chip key={n.id}>
                <Ref href={dbHref("npc", n.id)}>{n.name}</Ref>
              </Chip>
            ))}
          </Chips>
        </DetailBlock>
      )}
      <DetailSection
        title={t("db.georamaTasks")}
        rows={tasks.map((x) => (
          <Row key={x.id} title={x.name} aside={`${x.percent}%`}>
            <Detail>{x.goals.map((g) => g.name).join(" · ")}</Detail>
          </Row>
        ))}
        limit={5}
      />
      <DetailSection
        title={t("db.georamaRewards")}
        rows={rewards.map((r) => (
          <Row
            key={r.id}
            title={
              <Ref href={productHref(r)}>
                {names.items[r.itemId ?? ""] ?? names.weapons[r.weaponId ?? ""]}
              </Ref>
            }
            aside={r.quantity > 1 && `×${r.quantity}`}
          />
        ))}
      />
      {buildable.length > 0 && (
        <DetailBlock title={t("db.georamaParts")} meta={buildable.length}>
          <Chips>
            {buildable.map((x) => (
              <Chip key={x.georamaPartId}>
                <Ref href={dbHref("georamaPart", x.georamaPartId)}>
                  {names.georamaParts[x.georamaPartId]}
                </Ref>
                {x.maxCount != null && ` ≤${x.maxCount}`}
              </Chip>
            ))}
          </Chips>
        </DetailBlock>
      )}
      <DetailSection
        title={t("db.fishingSpots")}
        rows={fish.flatMap((f) =>
          f.habitats
            .filter((h) => h.townId === tw.id)
            .map((h, i) => (
              <Row key={`${f.id}-${i}`} title={<Ref href={dbHref("fish", f.id)}>{f.name}</Ref>}>
                <Detail>
                  {[
                    h.spot,
                    h.fromHour != null &&
                      h.toHour != null &&
                      t("fishing.hours", { from: h.fromHour, to: h.toHour }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Detail>
              </Row>
            )),
        )}
      />
      <DetailSection
        title={t("db.pickupsHere")}
        rows={pickups.map((p) => (
          <Row
            key={p.id}
            title={<Ref href={dbHref("item", p.itemId)}>{names.items[p.itemId]}</Ref>}
            aside={t("reference.chapterShort", { n: p.chapterNumber ?? "?" })}
          >
            {p.notes?.length ? <Detail>{p.notes.join(" · ")}</Detail> : null}
          </Row>
        ))}
        limit={6}
      />
      <DetailSection
        title={t("db.photosHere")}
        rows={photos.map((p) => (
          <Row
            key={p.id}
            title={<Ref href={dbHref("photo", p.id)}>{p.name}</Ref>}
            aside={t("reference.chapterShort", { n: p.chapterNumber ?? "?" })}
          />
        ))}
        limit={6}
      />
    </DetailPage>
  );
}

/** A dungeon: its floors in order, totals, the weapons in its chests and its fish. */
export function DungeonPage({ dungeon: d }: { dungeon: Dungeon }) {
  const t = useTranslations();
  // A copy: the lists in db/data are shared by every page.
  const sections = [...(sectionsOfDungeon.get(d.id) ?? [])].sort(
    (a, b) => a.chapterNumber - b.chapterNumber || a.position - b.position,
  );
  const total = (k: "abs" | "gilda") => sections.reduce((a, s) => a + (s[k] ?? 0), 0);
  const weapons = weaponsInDungeon.get(d.id) ?? [];
  const fish = fishInDungeon.get(d.id) ?? [];
  return (
    <DetailPage>
      <Hero
        kinds={[
          t("db.kind.dungeon"),
          d.chapterNumber && t("reference.chapterShort", { n: d.chapterNumber }),
          d.townId && <Ref href={dbHref("town", d.townId)}>{names.towns[d.townId]}</Ref>,
        ].filter(Boolean)}
        title={d.name}
        facts={[
          { label: t("db.floors"), value: sections.length },
          { label: t("db.abs"), value: fmt(total("abs")) },
          { label: t("db.gilda"), value: fmt(total("gilda")) },
        ]}
      />
      <DetailSection
        title={t("db.floors")}
        limit={60}
        rows={sections.map((s) => (
          <Row
            key={s.id}
            title={<SectionRef id={s.id} />}
            aside={s.abs ? t("db.absN", { n: fmt(s.abs) }) : undefined}
          >
            <Detail>
              {[
                s.type === "boss" && t("section.kind.boss"),
                t("reference.chapterShort", { n: s.chapterNumber }),
                s.medalTimeAttackSeconds &&
                  t("db.timeMedal", { time: time(s.medalTimeAttackSeconds) }),
                s.medalClearGoal && t(`clearGoal.${s.medalClearGoal}` as const),
                s.medalFishingCentimeters && t("db.fishMedal", { cm: s.medalFishingCentimeters }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.chestWeapons")}
        limit={10}
        rows={weapons.map((w) => (
          <Row key={w.id} title={<Ref href={dbHref("weapon", w.id)}>{w.name}</Ref>}>
            <Detail>
              {t(`weapons.${w.character}` as const)} · {t(`weapon.type.${w.type}` as const)}
            </Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.fishingSpots")}
        rows={fish.map((f) => (
          <Row key={f.id} title={<Ref href={dbHref("fish", f.id)}>{f.name}</Ref>}>
            <Detail>
              {f.habitats
                .filter((h) => h.dungeonId === d.id)
                .map((h) => h.spot)
                .filter(Boolean)
                .join(" · ")}
            </Detail>
          </Row>
        ))}
      />
    </DetailPage>
  );
}

/** A floor or boss fight: medals, enemies, Spheda prizes, materials, geostone, exits and more. */
export function FloorPage({ section: s }: { section: Section }) {
  const t = useTranslations();
  const d = floorDetail[s.id];
  const siblings = (s.dungeonId ? (sectionsOfDungeon.get(s.dungeonId) ?? []) : [])
    .slice()
    .sort((a, b) => a.chapterNumber - b.chapterNumber || a.position - b.position);
  const at = siblings.findIndex((x) => x.id === s.id);
  const prev = at > 0 ? siblings[at - 1] : undefined;
  const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : undefined;
  const enemyById = new Map(enemies.map((e) => [e.id, e]));
  const tier = { first: t("db.win.first"), second: t("db.win.second"), repeat: t("db.win.repeat") };
  const productName = (p: {
    itemId?: string;
    weaponId?: string;
    ridepodPartId?: string;
    ridepodCoreId?: string;
  }) =>
    names.items[p.itemId ?? ""] ??
    names.weapons[p.weaponId ?? ""] ??
    names.ridepodParts[p.ridepodPartId ?? ""] ??
    names.ridepodCores[p.ridepodCoreId ?? ""];
  const photos = photosOnFloor.get(s.id) ?? [];
  const pickups = pickupsOnFloor.get(s.id) ?? [];
  const fish = fishOnFloor.get(s.id) ?? [];
  return (
    <DetailPage>
      <Hero
        kinds={[
          <Ref href={`/chapters/${s.chapterNumber}`}>
            {t("reference.chapterShort", { n: s.chapterNumber })}
          </Ref>,
          s.dungeonId && (
            <Ref href={dbHref("dungeon", s.dungeonId)}>{names.dungeons[s.dungeonId]}</Ref>
          ),
          t(`section.kind.${s.type}` as const),
          s.optional && t("db.optional"),
        ].filter(Boolean)}
        title={s.title}
        facts={[
          d && d.totals.abs > 0 && { label: t("db.abs"), value: fmt(d.totals.abs) },
          d && d.totals.gilda > 0 && { label: t("db.gilda"), value: fmt(d.totals.gilda) },
          s.medalTimeAttackSeconds && {
            label: t("medal.time-attack"),
            value: time(s.medalTimeAttackSeconds),
          },
          s.medalFishingCentimeters && {
            label: t("medal.fishing"),
            value: `${s.medalFishingCentimeters} cm`,
          },
          s.timeLimitSeconds && { label: t("db.timeLimit"), value: time(s.timeLimitSeconds) },
        ]}
        actions={
          <a
            href={withBase(`/chapters/${s.chapterNumber}`)}
            className="bg-card shadow-sticker-sm rounded-md border-2 px-3 py-1.5 text-sm font-semibold"
          >
            {t("db.trackInChapter", { n: s.chapterNumber })}
          </a>
        }
      >
        <Chips>
          {s.medalClearGoal && (
            <Chip tone="accent">
              {t("medal.clear-goal")}: {t(`clearGoal.${s.medalClearGoal}` as const)}
            </Chip>
          )}
          {s.restriction && <Chip tone="dashed">{t(`db.seal.${s.restriction}` as const)}</Chip>}
          {s.hasGeostone && <Chip>{t("section.geostone")}</Chip>}
          {d?.totals.starAreaAbs ? (
            <Chip tone="dashed">
              {t("section.starArea")}:{" "}
              {t("section.totals", {
                abs: fmt(d.totals.starAreaAbs),
                gilda: fmt(d.totals.starAreaGilda ?? 0),
              })}
            </Chip>
          ) : null}
        </Chips>
        {s.closedAfterSectionId && (
          <Detail>{t("db.closedAfter", { name: names.sections[s.closedAfterSectionId] })}</Detail>
        )}
      </Hero>
      <DetailSection
        title={t("section.enemies")}
        limit={12}
        rows={(d?.enemies ?? []).map((e) => {
          const en = enemyById.get(e.enemyId);
          return (
            <Row
              key={`${e.enemyId}-${e.starArea}`}
              title={<Ref href={dbHref("enemy", e.enemyId)}>{names.enemies[e.enemyId]}</Ref>}
              aside={`×${e.count}`}
            >
              <Detail>
                {[
                  e.type && t(`bestiary.type.${e.type}` as const),
                  e.carriesKey && t("db.carriesKey"),
                  e.starArea && t("section.starArea"),
                  en?.abs && t("db.absN", { n: en.abs }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Detail>
            </Row>
          );
        })}
      />
      <DetailSection
        title={t("db.sphedaPrizes")}
        rows={Object.entries(d?.sphedaPrizes ?? {}).map(([k, p]) => (
          <Row
            key={k}
            tag={tier[k as keyof typeof tier]}
            title={<Ref href={productHref(p)}>{productName(p)}</Ref>}
            aside={p.quantity > 1 && `×${p.quantity}`}
          />
        ))}
      />
      <DetailSection
        title={t("db.rewards")}
        rows={(d?.rewards ?? []).map((r, i) => (
          <Row
            key={i}
            title={<Ref href={productHref(r)}>{productName(r)}</Ref>}
            aside={r.quantity > 1 && `×${r.quantity}`}
          >
            {r.character && (
              <Detail>{t("db.forCharacter", { who: t(`weapons.${r.character}` as const) })}</Detail>
            )}
          </Row>
        ))}
      />
      {d && d.georamaItems.length > 0 && (
        <DetailBlock title={t("db.georamaMaterials")} meta={d.georamaItems.length}>
          <Chips>
            {d.georamaItems.map((id) => (
              <Chip key={id}>
                <Ref href={dbHref("item", id)}>{names.items[id]}</Ref>
              </Chip>
            ))}
          </Chips>
        </DetailBlock>
      )}
      {d && d.geostoneParts.length > 0 && (
        <DetailBlock title={t("db.geostoneParts")} meta={d.geostoneParts.length}>
          <Chips>
            {d.geostoneParts.map((id) => (
              <Chip key={id}>
                <Ref href={dbHref("georamaPart", id)}>{names.georamaParts[id]}</Ref>
              </Chip>
            ))}
          </Chips>
        </DetailBlock>
      )}
      <DetailSection
        title={t("db.pickupsHere")}
        rows={pickups.map((p) => (
          <Row
            key={p.id}
            title={<Ref href={dbHref("item", p.itemId)}>{names.items[p.itemId]}</Ref>}
            aside={p.quantity > 1 && `×${p.quantity}`}
          >
            {p.notes?.length ? <Detail>{p.notes.join(" · ")}</Detail> : null}
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.photosHere")}
        rows={photos.map((p) => (
          <Row
            key={p.id}
            title={<Ref href={dbHref("photo", p.id)}>{p.name}</Ref>}
            aside={t("db.pointsN", { n: p.points })}
          />
        ))}
      />
      <DetailSection
        title={t("db.fishingSpots")}
        rows={fish.map((f) => (
          <Row key={f.id} title={<Ref href={dbHref("fish", f.id)}>{f.name}</Ref>}>
            <Detail>
              {f.habitats
                .filter((h) => h.sectionId === s.id)
                .map((h) => h.spot)
                .filter(Boolean)
                .join(" · ")}
            </Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.exits")}
        rows={[
          ...(prev
            ? [<Row key="prev" tag={t("db.previous")} title={<SectionRef id={prev.id} />} />]
            : []),
          ...(d?.exits ?? []).map((x) => (
            <Row
              key={x.toSectionId + x.type}
              tag={x.type === "normal" ? t("db.next") : t(`db.exit.${x.type}` as const)}
              title={<SectionRef id={x.toSectionId} />}
            />
          )),
          ...(next && !(d?.exits ?? []).some((x) => x.toSectionId === next.id)
            ? [<Row key="next" tag={t("db.next")} title={<SectionRef id={next.id} />} />]
            : []),
        ]}
      />
    </DetailPage>
  );
}
