import type { ReactNode } from "react";
import { useTranslations } from "@/i18n";
import type { Item } from "@/lib/gamedata/types";
import {
  byId,
  evolutionsNeedingItem,
  fishAsItem,
  fishWithTackle,
  fishing,
  georamaPartsUsingItem,
  inventionsUsingItem,
  materialFloorsOf,
  monsterUnlocksWithItem,
  names,
  recruitsNeeding,
  ridepodPartAsItem,
} from "@/lib/db/data";
import { dbHref, monsterFormHref } from "@/lib/db/routes";
import { itemAvailability } from "@/lib/planner/sources";
import { Chip, Chips, DetailPage, DetailSection, Detail, Hero, Ref, Row } from "../kit";
import { LinkList, SectionRef, sourceRows } from "../sources";
import { effectText } from "../text";
import { statGains } from "../stats";

/** An item: what it does, every way to get it and everything it's used for. */
export function ItemPage({ item: i, actions }: { item: Item; actions?: ReactNode }) {
  const t = useTranslations();
  const shop = itemAvailability(i.name);
  const gains = statGains(i, "synth");
  const sources = { ...i.sources, sphedaPrizes: undefined };
  const fish = fishAsItem.get(i.id);
  const part = ridepodPartAsItem.get(i.id);
  const attracts = fishWithTackle.get(i.id) ?? [];
  const feed = fishing.feedEffects.filter((e) => e.itemId === i.id);

  const uses: ReactNode[] = [
    ...(inventionsUsingItem.get(i.id) ?? []).map((inv) => (
      <Row
        key={`inv-${inv.id}`}
        tag={t("db.src.invention")}
        title={<Ref href={dbHref("invention", inv.id)}>{inv.name}</Ref>}
        aside={`×${inv.items.find((m) => m.itemId === i.id)!.quantity}`}
      >
        <Detail>{t("db.material")}</Detail>
      </Row>
    )),
    ...(georamaPartsUsingItem.get(i.id) ?? []).map((p) => (
      <Row
        key={`geo-${p.id}`}
        tag={t("db.src.georama")}
        title={<Ref href={dbHref("georamaPart", p.id)}>{p.name}</Ref>}
        aside={`×${p.items.find((m) => m.itemId === i.id)!.quantity}`}
      >
        <Detail>{t("db.georamaPart")}</Detail>
      </Row>
    )),
    ...(recruitsNeeding.item.get(i.id) ?? []).map((r) => {
      const q = r.requirements.find((x) => x.itemId === i.id)!;
      return (
        <Row
          key={`rec-${r.npcId}`}
          tag={t("db.src.recruit")}
          title={<Ref href={dbHref("npc", r.npcId)}>{names.npcs[r.npcId]}</Ref>}
          aside={q.quantity && q.quantity > 1 ? `×${q.quantity}` : undefined}
        >
          <Detail>{q.type === "give-item" ? t("db.req.give") : t("db.req.show")}</Detail>
        </Row>
      );
    }),
    ...(monsterUnlocksWithItem.get(i.id) ?? []).map((u) => (
      <Row
        key={`mon-${u.id}`}
        tag={t("db.src.monster")}
        title={
          <Ref href={dbHref("monsterClass", u.classId)}>{names.monsterClasses[u.classId]}</Ref>
        }
      >
        <Detail>
          {t(`db.unlock.${u.method}` as const, {
            n: u.quantity ?? 1,
            enemy: u.enemyId ? names.enemies[u.enemyId] : "",
          })}
        </Detail>
      </Row>
    )),
    ...(evolutionsNeedingItem.get(i.id) ?? []).flatMap((f) =>
      f.evolvesInto
        .filter((e) => e.requiredItemId === i.id)
        .map((e) => {
          const to = byId.monsterForm.get(e.toId)!;
          return (
            <Row
              key={`evo-${f.id}-${e.toId}`}
              tag={t("db.src.monster")}
              title={<Ref href={monsterFormHref(to.classId, to.id)}>{to.name}</Ref>}
              aside={e.requiredQuantity && `×${e.requiredQuantity}`}
            >
              <Detail>{t("db.evolveNeeds", { from: f.name, n: e.level })}</Detail>
            </Row>
          );
        }),
    ),
    ...(attracts.length
      ? [
          <Row
            key="tackle"
            tag={t("db.src.fishing")}
            title={
              <LinkList
                links={attracts.map((f) => (
                  <Ref href={dbHref("fish", f.id)}>{f.name}</Ref>
                ))}
                max={6}
              />
            }
          >
            <Detail>{t("db.attracts", { n: attracts.length })}</Detail>
          </Row>,
        ]
      : []),
    ...(fish
      ? [
          <Row
            key="fish"
            tag={t("db.src.fishing")}
            title={<Ref href={dbHref("fish", fish.id)}>{fish.name}</Ref>}
          >
            <Detail>{t("db.isFish")}</Detail>
          </Row>,
        ]
      : []),
    ...(part
      ? [
          <Row
            key="part"
            tag={t("db.src.ridepod")}
            title={<Ref href={dbHref("ridepodPart", part.id)}>{part.name}</Ref>}
          >
            <Detail>{t("db.isRidepodPart")}</Detail>
          </Row>,
        ]
      : []),
    ...(gains.length || i.synthDurability
      ? [
          <Row
            key="synth"
            tag={t("db.src.synth")}
            title={t("db.synthOnto")}
            aside={i.synthPointCost != null && t("people.skillSp", { n: i.synthPointCost })}
          >
            <Chips>
              {gains.map((g) => (
                <Chip key={g.key}>
                  {t(`stat.${g.key}` as const)} +{g.value}
                </Chip>
              ))}
              {!!i.synthDurability && (
                <Chip tone="dashed">
                  {t("stat.short.du")} +{i.synthDurability}
                </Chip>
              )}
            </Chips>
          </Row>,
        ]
      : []),
    ...(i.abilityId
      ? [
          <Row
            key="ability"
            tag={t("db.src.synth")}
            title={<Ref href={dbHref("ability", i.abilityId)}>{names.abilities[i.abilityId]}</Ref>}
          >
            <Detail>{t("db.passesAbility")}</Detail>
          </Row>,
        ]
      : []),
  ];

  const tier = { first: t("db.win.first"), second: t("db.win.second"), repeat: t("db.win.repeat") };
  const materialFloors = materialFloorsOf.get(i.id) ?? [];

  return (
    <DetailPage>
      <Hero
        kinds={[
          i.type && t(`db.itemType.${i.type}` as const),
          i.synthCategory && t("db.synthCategory", { c: i.synthCategory }),
          i.equipCharacter && t(`db.owner.${i.equipCharacter}` as const),
          i.equipSlot && t(`db.slot.${i.equipSlot}` as const),
        ].filter(Boolean)}
        title={i.name}
        description={i.description}
        facts={[
          shop.kind === "buyable"
            ? {
                label: t("db.cheapest"),
                value: t("items.gilda", { n: shop.price.toLocaleString("en") }),
              }
            : { label: t("db.cheapest"), value: t("items.foundOnly") },
          shop.kind === "buyable" && {
            label: t("db.from"),
            value: t("reference.chapterShort", { n: shop.fromChapter }),
          },
          i.maxStack != null && { label: t("db.maxStack"), value: i.maxStack },
          i.powerupStat && {
            label: t("db.powerUp"),
            value: `${t(`db.powerup.${i.powerupStat}` as const)} +${i.powerupAmount ?? 1}`,
          },
        ]}
        actions={actions}
      >
        {(i.effects.length > 0 || gains.length > 0) && (
          <Chips>
            {i.effects.map((e, n) => (
              <Chip key={`e${n}`} tone="good">
                {effectText(t, e)}
              </Chip>
            ))}
            {gains.map((g) => (
              <Chip key={g.key}>
                {t(`stat.short.${g.key}` as const)} +{g.value}
              </Chip>
            ))}
          </Chips>
        )}
      </Hero>
      <DetailSection title={t("db.whereToGet")} rows={sourceRows(t, sources)} />
      <DetailSection
        title={t("db.sphedaPrizes")}
        rows={(i.sources.sphedaPrizes ?? []).map((p) => (
          <Row
            key={`${p.sectionId}-${p.tier}`}
            title={<SectionRef id={p.sectionId} />}
            aside={`×${p.quantity}`}
          >
            <Detail>
              {tier[p.tier]} ·{" "}
              {t("reference.chapterShort", {
                n: byId.section.get(p.sectionId)?.chapterNumber ?? "?",
              })}
            </Detail>
          </Row>
        ))}
        limit={5}
      />
      <DetailSection
        title={t("db.foundOnFloors")}
        rows={materialFloors.map((id) => (
          <Row key={id} title={<SectionRef id={id} />}>
            <Detail>
              {[
                byId.section.get(id)?.dungeonId && names.dungeons[byId.section.get(id)!.dungeonId!],
                t("reference.chapterShort", { n: byId.section.get(id)?.chapterNumber ?? "?" }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Detail>
          </Row>
        ))}
        limit={5}
      />
      <DetailSection title={t("db.usedFor")} rows={uses} />
      {feed.length > 0 && (
        <DetailSection
          title={t("db.feeding")}
          rows={feed.map((e) => (
            <Row
              key={e.stat}
              title={t(`fishing.feed.${e.change}` as const, {
                stat: t(`fishing.stat.${e.stat}` as const),
              })}
            />
          ))}
        />
      )}
    </DetailPage>
  );
}
