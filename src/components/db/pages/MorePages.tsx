// Detail pages for the smaller kinds: Ridepod parts and cores, shops, people, fish, inventions,
// photos, Georama parts and abilities.
import type { ReactNode } from "react";
import { useTranslations } from "@/i18n";
import type {
  Ability,
  Fish,
  GeoramaPart,
  Invention,
  Npc,
  Photo,
  RidepodCore,
  RidepodPart,
  Shop,
} from "@/lib/gamedata/types";
import {
  byId,
  fishing,
  geostoneFloorsOf,
  housingNear,
  housingNeeds,
  inventionMaking,
  inventionsUsingPhoto,
  itemsWithAbility,
  materialFloorsOf,
  names,
  recruitsNeeding,
  shopsAfterRecruiting,
  shopsInTown,
  shopsKeptBy,
  townsBuilding,
  trophiesFor,
  weaponsWithAbility,
  georama,
  collectables,
} from "@/lib/db/data";
import { dbHref, productHref } from "@/lib/db/routes";
import { Chip, Chips, DetailPage, DetailSection, Detail, Hero, Ref, Row } from "../kit";
import { LinkList, SectionRef, sourceRows } from "../sources";
import { requirementText } from "../text";

type T = ReturnType<typeof useTranslations>;

const trophyRows = (
  t: T,
  list: { id: string; name: string; tier: string; description?: string }[],
) =>
  list.map((x) => (
    <Row key={x.id} title={x.name} aside={<Chip>{t(`trophy.${x.tier}` as "trophy.gold")}</Chip>}>
      {x.description && <Detail>{x.description}</Detail>}
    </Row>
  ));

const productName = (p: {
  itemId?: string;
  weaponId?: string;
  ridepodPartId?: string;
  ridepodCoreId?: string;
}) =>
  p.itemId
    ? names.items[p.itemId]
    : p.weaponId
      ? names.weapons[p.weaponId]
      : p.ridepodPartId
        ? names.ridepodParts[p.ridepodPartId]
        : names.ridepodCores[p.ridepodCoreId ?? ""];

/** When a shop or listing can be bought, in words. */
export function availabilityText(
  t: T,
  a: {
    fromChapterNumber?: number;
    afterSectionId?: string;
    afterRecruitNpcId?: string;
    afterGeoramaTaskId?: number;
    untilChapterNumber?: number;
    untilSectionId?: string;
    untilRecruitNpcId?: string;
  },
): string[] {
  const task = a.afterGeoramaTaskId
    ? collectables.georamaTasks.find((x) => x.id === a.afterGeoramaTaskId)
    : undefined;
  return [
    a.fromChapterNumber && t("reference.fromChapter", { n: a.fromChapterNumber }),
    a.afterSectionId && t("db.afterSection", { name: names.sections[a.afterSectionId] }),
    a.afterRecruitNpcId && t("shops.afterRecruit", { npc: names.npcs[a.afterRecruitNpcId] }),
    task && t("db.afterGeorama", { name: task.name }),
    a.untilChapterNumber && t("db.untilChapter", { n: a.untilChapterNumber }),
    a.untilSectionId && t("db.untilSection", { name: names.sections[a.untilSectionId] }),
    a.untilRecruitNpcId && t("shops.untilRecruit", { npc: names.npcs[a.untilRecruitNpcId] }),
  ].filter((x): x is string => !!x);
}

// ─── Ridepod ──────────────────────────────────────────────────────────────────────────────────────

/** A Ridepod part: its stats, recipe and where to get it. */
export function RidepodPartPage({ part: p, actions }: { part: RidepodPart; actions?: ReactNode }) {
  const t = useTranslations();
  const inv = inventionMaking({ ridepodPartId: p.id });
  const w = p.weapon;
  const stats = w
    ? (
        [
          ["attack", "stat.at"],
          ["flame", "stat.fl"],
          ["chill", "stat.ch"],
          ["lightning", "stat.li"],
          ["cyclone", "stat.cy"],
          ["smash", "stat.sm"],
          ["exorcism", "stat.ex"],
          ["beast", "stat.be"],
          ["scale", "stat.sc"],
        ] as const
      ).filter(([k]) => (w as Record<string, unknown>)[k])
    : [];
  return (
    <DetailPage>
      <Hero
        kinds={[t(`db.partType.${p.type}` as const), w && t("db.tierN", { n: w.tier })]}
        title={p.name}
        facts={[
          { label: t("db.capacity"), value: p.capacity },
          w && { label: t("db.weaponHp"), value: w.weaponHp },
          p.body && { label: t("db.armor"), value: p.body.armor },
          p.legs && { label: t("db.speed"), value: p.legs.speed },
          p.energyPack && { label: t("db.energy"), value: p.energyPack.energy },
        ]}
        actions={actions}
      >
        {stats.length > 0 && (
          <Chips>
            {stats.map(([k, key]) => (
              <Chip key={k}>
                {t(key)} {(w as unknown as Record<string, number>)[k]}
              </Chip>
            ))}
          </Chips>
        )}
      </Hero>
      <DetailSection title={t("db.whereToGet")} rows={sourceRows(t, p.sources)} />
      {inv && (
        <DetailSection
          title={t("db.recipe")}
          rows={inv.recipes.map((r, i) => (
            <Row
              key={i}
              title={
                <LinkList
                  links={r.map((id) => (
                    <Ref href={dbHref("photo", id)}>{names.photos[id]}</Ref>
                  ))}
                  max={6}
                />
              }
            >
              <Detail>{i ? t("db.otherRecipe") : t("db.mainRecipe")}</Detail>
            </Row>
          ))}
        />
      )}
      {p.itemId && (
        <DetailSection
          title={t("db.asItem")}
          rows={[
            <Row
              key="item"
              title={<Ref href={dbHref("item", p.itemId)}>{names.items[p.itemId]}</Ref>}
            />,
          ]}
        />
      )}
    </DetailPage>
  );
}

/** A Ridepod core. */
export function RidepodCorePage({ core: c, actions }: { core: RidepodCore; actions?: ReactNode }) {
  const t = useTranslations();
  return (
    <DetailPage>
      <Hero
        kinds={[t("db.kind.core")]}
        title={c.name}
        facts={[
          { label: t("db.capacity"), value: c.capacity },
          c.armorCapacity != null && { label: t("db.armorCapacity"), value: c.armorCapacity },
        ]}
        actions={actions}
      />
      <DetailSection title={t("db.whereToGet")} rows={sourceRows(t, c.sources)} />
      <DetailSection
        title={t("db.trophies")}
        rows={trophyRows(t, trophiesFor.ridepodCore.get(c.id) ?? [])}
      />
    </DetailPage>
  );
}

// ─── shops ────────────────────────────────────────────────────────────────────────────────────────

/** A shop: its keeper, when it opens and everything it sells. */
export function ShopPage({ shop: s }: { shop: Shop }) {
  const t = useTranslations();
  const price = (n: number | undefined) =>
    n == null
      ? t("shops.varies")
      : t(`shops.currency.${s.currency}` as const, { n: n.toLocaleString("en") });
  const kind = (x: Shop["stock"][number]) =>
    x.weaponId ? "weapon" : x.ridepodPartId || x.ridepodCoreId ? "ridepod" : "item";
  const groups = (["item", "weapon", "ridepod"] as const)
    .map((k) => ({ k, stock: s.stock.filter((x) => kind(x) === k) }))
    .filter((g) => g.stock.length);
  const others = (s.townId ? (shopsInTown.get(s.townId) ?? []) : []).filter((o) => o.id !== s.id);
  return (
    <DetailPage>
      <Hero
        kinds={[
          t("db.kind.shop"),
          s.townId ? (
            <Ref href={dbHref("town", s.townId)}>{names.towns[s.townId]}</Ref>
          ) : (
            t("shops.sellers")
          ),
        ]}
        title={s.name}
        facts={[
          s.npcId && {
            label: t("db.keeper"),
            value: (
              <Ref href={dbHref("npc", s.npcId)} className="text-base">
                {names.npcs[s.npcId]}
              </Ref>
            ),
          },
          {
            label: t("db.paysIn"),
            value: <span className="text-base">{t(`db.currency.${s.currency}` as const)}</span>,
          },
          { label: t("db.things"), value: s.stock.length },
        ]}
      >
        {availabilityText(t, s).length > 0 && <Detail>{availabilityText(t, s).join(" · ")}</Detail>}
      </Hero>
      {groups.map((g) => (
        <DetailSection
          key={g.k}
          title={t(`db.stock.${g.k}` as const)}
          limit={40}
          rows={g.stock.map((x) => (
            <Row
              key={x.id}
              title={<Ref href={productHref(x)}>{productName(x)}</Ref>}
              aside={<b>{price(x.price)}</b>}
            >
              {(availabilityText(t, x).length > 0 || x.purchaseLimit) && (
                <Detail>
                  {[
                    ...availabilityText(t, x),
                    x.purchaseLimit && t("shops.limit", { n: x.purchaseLimit }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Detail>
              )}
            </Row>
          ))}
        />
      ))}
      <DetailSection
        title={
          s.townId ? t("db.otherShopsIn", { town: names.towns[s.townId] }) : t("db.otherShops")
        }
        rows={others.map((o) => (
          <Row key={o.id} title={<Ref href={dbHref("shop", o.id)}>{o.name}</Ref>}>
            {o.npcId && <Detail>{names.npcs[o.npcId]}</Detail>}
          </Row>
        ))}
      />
    </DetailPage>
  );
}

// ─── people ───────────────────────────────────────────────────────────────────────────────────────

/** A person: support skills, recruiting, shops and what they want from a Georama home. */
export function PersonPage({ npc: n, actions }: { npc: Npc; actions?: ReactNode }) {
  const t = useTranslations();
  const r = byId.recruit.get(n.id);
  const housing = housingNeeds.get(n.id) ?? [];
  const shopsRun = shopsKeptBy.get(n.id) ?? [];
  const shopsOpened = shopsAfterRecruiting.get(n.id) ?? [];
  return (
    <DetailPage>
      <Hero
        kinds={[
          t("db.kind.npc"),
          n.homeTownId && (
            <Ref href={dbHref("town", n.homeTownId)}>{names.towns[n.homeTownId]}</Ref>
          ),
        ].filter(Boolean)}
        title={n.name}
        facts={[
          r && {
            label: t("db.recruit"),
            value: t("reference.chapterShort", { n: r.chapterNumber ?? "?" }),
          },
          n.maxSkillPoints != null && { label: t("db.skillPoints"), value: n.maxSkillPoints },
        ]}
        actions={actions}
      />
      <DetailSection
        title={t("db.skills")}
        rows={n.skills.map((s) => (
          <Row
            key={s.id}
            title={s.name}
            aside={s.skillPointCost != null && t("people.skillSp", { n: s.skillPointCost })}
          >
            {s.description && <Detail>{s.description}</Detail>}
          </Row>
        ))}
      />
      {r && (
        <DetailSection
          title={t("db.howToRecruit")}
          meta={r.questName ? `“${r.questName}”` : undefined}
          rows={[
            ...(r.location ? [<Row key="where" tag={t("db.where")} title={r.location} />] : []),
            ...r.requirements.map((q, i) => (
              <Row key={i} tag={t("db.needs")} title={requirementText(t, q)} />
            )),
          ]}
        />
      )}
      <DetailSection
        title={t("db.shops")}
        rows={[
          ...shopsRun.map((s) => (
            <Row key={`run-${s.id}`} title={<Ref href={dbHref("shop", s.id)}>{s.name}</Ref>}>
              <Detail>{t("db.runsIt")}</Detail>
            </Row>
          )),
          ...shopsOpened.map((s) => (
            <Row key={`open-${s.id}`} title={<Ref href={dbHref("shop", s.id)}>{s.name}</Ref>}>
              <Detail>{t("db.opensAfterRecruiting")}</Detail>
            </Row>
          )),
        ]}
      />
      <DetailSection
        title={t("db.housing")}
        rows={housing.map((h) => (
          <Row
            key={h.id}
            title={
              h.georamaPartId ? (
                <>
                  {t(`db.housing.${h.type}` as const, {
                    n: h.quantity ?? "",
                    color: h.color ?? "",
                  })}{" "}
                  <Ref href={dbHref("georamaPart", h.georamaPartId)}>
                    {names.georamaParts[h.georamaPartId]}
                  </Ref>
                </>
              ) : h.type === "other" ? (
                h.text
              ) : (
                t(`db.housing.${h.type}` as const, { n: h.quantity ?? "", color: h.color ?? "" })
              )
            }
          />
        ))}
      />
    </DetailPage>
  );
}

// ─── fish ─────────────────────────────────────────────────────────────────────────────────────────

/** Where a fish bites ("Lake · 18:00–6:00"). */
export function FishPage({ fish: f }: { fish: Fish }) {
  const t = useTranslations();
  const asChild = fishing.breeding.filter((b) => b.childId === f.id);
  const asParent = fishing.breeding.filter((b) => b.parentAId === f.id || b.parentBId === f.id);
  const wanted = recruitsNeeding.fish.get(f.id) ?? [];
  const fishRef = (id: string) => <Ref href={dbHref("fish", id)}>{names.fish[id]}</Ref>;
  return (
    <DetailPage>
      <Hero
        kinds={[t("db.kind.fish")]}
        title={f.name}
        facts={[
          { label: t("db.places"), value: f.habitats.length },
          { label: t("db.tackle"), value: f.tackle.length },
          { label: t("db.bredFromPairs"), value: asChild.length },
        ]}
      >
        {f.tackle.length > 0 && (
          <Chips>
            {f.tackle.map((id) => (
              <Chip key={id}>
                <Ref href={dbHref("item", id)}>{names.items[id]}</Ref>
              </Chip>
            ))}
          </Chips>
        )}
        {f.rejectIn && (
          <Detail>
            {t("fishing.rejects", { water: t(`fishing.water.${f.rejectIn}` as const) })}
          </Detail>
        )}
      </Hero>
      <DetailSection
        title={t("db.whereItBites")}
        rows={f.habitats.map((h, i) => (
          <Row
            key={i}
            title={
              h.sectionId ? (
                <SectionRef id={h.sectionId} />
              ) : h.dungeonId ? (
                <Ref href={dbHref("dungeon", h.dungeonId)}>{names.dungeons[h.dungeonId]}</Ref>
              ) : (
                <Ref href={dbHref("town", h.townId!)}>{names.towns[h.townId!]}</Ref>
              )
            }
          >
            <Detail>
              {[
                h.spot,
                h.fromHour != null &&
                  h.toHour != null &&
                  t("fishing.hours", { from: h.fromHour, to: h.toHour }),
                h.sectionId &&
                  t("reference.chapterShort", {
                    n: byId.section.get(h.sectionId)?.chapterNumber ?? "?",
                  }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.bredFrom")}
        rows={asChild.map((b, i) => (
          <Row
            key={i}
            title={
              <>
                {fishRef(b.parentAId)} × {fishRef(b.parentBId)}
              </>
            }
          />
        ))}
        limit={5}
      />
      <DetailSection
        title={t("db.breedsInto")}
        rows={asParent.map((b, i) => (
          <Row key={i} title={fishRef(b.childId)}>
            <Detail>
              {t("db.with")} {fishRef(b.parentAId === f.id ? b.parentBId : b.parentAId)}
            </Detail>
          </Row>
        ))}
        limit={5}
      />
      <DetailSection
        title={t("db.wantedBy")}
        rows={wanted.map((r) => (
          <Row key={r.npcId} title={<Ref href={dbHref("npc", r.npcId)}>{names.npcs[r.npcId]}</Ref>}>
            <Detail>{t("db.recruitRequirement")}</Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.trophies")}
        rows={trophyRows(t, trophiesFor.fish.get(f.id) ?? [])}
      />
      {f.itemId && (
        <DetailSection
          title={t("db.asItem")}
          rows={[
            <Row
              key="item"
              title={<Ref href={dbHref("item", f.itemId)}>{names.items[f.itemId]}</Ref>}
            />,
          ]}
        />
      )}
    </DetailPage>
  );
}

// ─── inventions and photos ────────────────────────────────────────────────────────────────────────

/** An invention: the idea photos, the materials, what it makes and where the recipe is. */
export function InventionPage({
  invention: v,
  actions,
}: {
  invention: Invention;
  actions?: ReactNode;
}) {
  const t = useTranslations();
  const makes = v.weaponId
    ? { href: dbHref("weapon", v.weaponId), name: names.weapons[v.weaponId] }
    : v.ridepodPartId
      ? { href: dbHref("ridepodPart", v.ridepodPartId), name: names.ridepodParts[v.ridepodPartId] }
      : v.itemId
        ? { href: dbHref("item", v.itemId), name: names.items[v.itemId] }
        : undefined;
  return (
    <DetailPage>
      <Hero
        kinds={[
          t("db.kind.invention"),
          v.chapterNumber && t("reference.chapterShort", { n: v.chapterNumber }),
          v.missable && t("db.missable"),
        ].filter(Boolean)}
        title={v.name}
        facts={[
          makes && {
            label: t("db.makes"),
            value: (
              <Ref href={makes.href} className="text-base">
                {makes.name}
              </Ref>
            ),
          },
          v.recipeLocation && {
            label: t("db.recipeAt"),
            value: <span className="text-base">{v.recipeLocation}</span>,
          },
        ]}
        actions={actions}
      >
        {v.notes?.length ? <Detail>{v.notes.join(" · ")}</Detail> : null}
      </Hero>
      <DetailSection
        title={t("db.ideas")}
        rows={v.recipes.map((r, i) => (
          <Row
            key={i}
            title={
              <LinkList
                links={r.map((id) => (
                  <Ref href={dbHref("photo", id)}>{names.photos[id]}</Ref>
                ))}
                max={6}
              />
            }
          >
            <Detail>{i ? t("db.otherRecipe") : t("db.mainRecipe")}</Detail>
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.materials")}
        rows={v.items.map((m) => (
          <Row
            key={m.itemId}
            title={<Ref href={dbHref("item", m.itemId)}>{names.items[m.itemId]}</Ref>}
            aside={`×${m.quantity}`}
          />
        ))}
      />
      {(v.sectionId || v.townId) && (
        <DetailSection
          title={t("db.available")}
          rows={[
            <Row
              key="where"
              title={
                v.sectionId ? (
                  <SectionRef id={v.sectionId} />
                ) : (
                  <Ref href={dbHref("town", v.townId!)}>{names.towns[v.townId!]}</Ref>
                )
              }
            >
              <Detail>{availabilityText(t, v).join(" · ")}</Detail>
            </Row>,
          ]}
        />
      )}
    </DetailPage>
  );
}

/** A photo: where and when to take it, its points and the inventions that need it. */
export function PhotoPage({ photo: p, actions }: { photo: Photo; actions?: ReactNode }) {
  const t = useTranslations();
  const used = inventionsUsingPhoto.get(p.id) ?? [];
  const recruits = recruitsNeeding.photo.get(p.id) ?? [];
  const enemy = [...byId.enemy.values()].find((e) => e.photoId === p.id);
  return (
    <DetailPage>
      <Hero
        kinds={[
          t(`db.photoType.${p.type}` as const),
          p.chapterNumber && t("reference.chapterShort", { n: p.chapterNumber }),
          p.missable && t("db.missable"),
          p.onlyChance && t("db.onlyChance"),
          p.ghost && t("db.ghost"),
        ].filter(Boolean)}
        title={p.name}
        description={p.description}
        facts={[
          { label: t("db.points"), value: p.points },
          p.fromHour != null &&
            p.toHour != null && {
              label: t("db.hours"),
              value: t("fishing.hours", { from: p.fromHour, to: p.toHour }),
            },
        ]}
        actions={actions}
      >
        {p.notes?.length ? <Detail>{p.notes.join(" · ")}</Detail> : null}
      </Hero>
      <DetailSection
        title={t("db.where")}
        rows={[
          ...(p.sectionId
            ? [
                <Row key="s" title={<SectionRef id={p.sectionId} />}>
                  <Detail>{availabilityText(t, p).join(" · ")}</Detail>
                </Row>,
              ]
            : []),
          ...(p.townId
            ? [
                <Row
                  key="t"
                  title={<Ref href={dbHref("town", p.townId)}>{names.towns[p.townId]}</Ref>}
                />,
              ]
            : []),
          ...(p.requiresGeoramaPartId
            ? [
                <Row
                  key="g"
                  title={
                    <Ref href={dbHref("georamaPart", p.requiresGeoramaPartId)}>
                      {names.georamaParts[p.requiresGeoramaPartId]}
                    </Ref>
                  }
                >
                  <Detail>{t("db.needsPart")}</Detail>
                </Row>,
              ]
            : []),
          ...(enemy
            ? [
                <Row key="e" title={<Ref href={dbHref("enemy", enemy.id)}>{enemy.name}</Ref>}>
                  <Detail>{t("db.ofEnemy")}</Detail>
                </Row>,
              ]
            : []),
        ]}
      />
      <DetailSection
        title={t("db.usedInInventions")}
        rows={used.map((v) => (
          <Row
            key={v.id}
            title={<Ref href={dbHref("invention", v.id)}>{v.name}</Ref>}
            aside={v.chapterNumber && t("reference.chapterShort", { n: v.chapterNumber })}
          />
        ))}
      />
      <DetailSection
        title={t("db.wantedBy")}
        rows={recruits.map((r) => (
          <Row key={r.npcId} title={<Ref href={dbHref("npc", r.npcId)}>{names.npcs[r.npcId]}</Ref>}>
            <Detail>{t("db.recruitRequirement")}</Detail>
          </Row>
        ))}
      />
    </DetailPage>
  );
}

// ─── Georama ──────────────────────────────────────────────────────────────────────────────────────

/** A Georama part: materials, cost, the towns that build it and the geostones that unlock it. */
export function GeoramaPartPage({ part: p, actions }: { part: GeoramaPart; actions?: ReactNode }) {
  const t = useTranslations();
  const towns = townsBuilding.get(p.id) ?? [];
  const geostones = geostoneFloorsOf.get(p.id) ?? [];
  const starting = georama.startingParts.filter((s) => s.georamaPartId === p.id);
  const residents = housingNear.get(p.id) ?? [];
  return (
    <DetailPage>
      <Hero
        kinds={[
          t("db.kind.georamaPart"),
          p.placement && t(`db.placement.${p.placement}` as const),
          p.category,
        ].filter(Boolean)}
        title={p.name}
        facts={[
          p.polynCost != null && { label: t("db.polyn"), value: p.polynCost },
          p.culturePoints != null && { label: t("db.culture"), value: p.culturePoints },
          { label: t("db.materials"), value: p.items.reduce((a, m) => a + m.quantity, 0) },
        ]}
        actions={actions}
      />
      <DetailSection
        title={t("db.materials")}
        rows={p.items.map((m) => (
          <Row
            key={m.itemId}
            title={<Ref href={dbHref("item", m.itemId)}>{names.items[m.itemId]}</Ref>}
            aside={`×${m.quantity}`}
          >
            {(materialFloorsOf.get(m.itemId)?.length ?? 0) > 0 && (
              <Detail>{t("db.foundOnN", { n: materialFloorsOf.get(m.itemId)!.length })}</Detail>
            )}
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.townsBuilding")}
        rows={[
          ...towns.map((x) => (
            <Row
              key={x.townId}
              title={<Ref href={dbHref("town", x.townId)}>{names.towns[x.townId]}</Ref>}
            >
              {x.maxCount != null && <Detail>{t("db.atMost", { n: x.maxCount })}</Detail>}
            </Row>
          )),
          ...starting.map((x) => (
            <Row
              key={`start-${x.townId}`}
              title={<Ref href={dbHref("town", x.townId)}>{names.towns[x.townId]}</Ref>}
              aside={x.quantity && `×${x.quantity}`}
            >
              <Detail>{t("db.startsWith")}</Detail>
            </Row>
          )),
        ]}
      />
      <DetailSection
        title={t("db.unlockedBy")}
        rows={geostones.map((id) => (
          <Row
            key={id}
            title={<SectionRef id={id} />}
            aside={t("reference.chapterShort", { n: byId.section.get(id)?.chapterNumber ?? "?" })}
          />
        ))}
      />
      <DetailSection
        title={t("db.residents")}
        rows={residents.map((h) => (
          <Row key={h.id} title={<Ref href={dbHref("npc", h.npcId)}>{names.npcs[h.npcId]}</Ref>}>
            <Detail>
              {t(`db.housing.${h.type}` as const, { n: h.quantity ?? "", color: h.color ?? "" })}
            </Detail>
          </Row>
        ))}
      />
    </DetailPage>
  );
}

// ─── abilities ────────────────────────────────────────────────────────────────────────────────────

/** An ability: what it does, the weapons with it and the items that pass it on. */
export function AbilityPage({ ability: a }: { ability: Ability }) {
  const t = useTranslations();
  const weapons = weaponsWithAbility.get(a.id) ?? [];
  const items = itemsWithAbility.get(a.id) ?? [];
  return (
    <DetailPage>
      <Hero
        kinds={[t("db.kind.ability")]}
        title={a.name}
        description={a.description}
        facts={[{ label: t("nav.weapons"), value: weapons.length }]}
      />
      <DetailSection
        title={t("db.itemsPassing")}
        rows={items.map((i) => (
          <Row key={i.id} title={<Ref href={dbHref("item", i.id)}>{i.name}</Ref>}>
            {i.type && <Detail>{t(`db.itemType.${i.type}` as const)}</Detail>}
          </Row>
        ))}
      />
      <DetailSection
        title={t("db.weaponsWith")}
        limit={12}
        rows={weapons.map((w) => (
          <Row key={w.id} title={<Ref href={dbHref("weapon", w.id)}>{w.name}</Ref>}>
            <Detail>
              {t(`weapons.${w.character}` as const)} · {t(`weapon.type.${w.type}` as const)}
            </Detail>
          </Row>
        ))}
      />
    </DetailPage>
  );
}
