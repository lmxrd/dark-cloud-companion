import { useMemo } from "react";
import { useTranslations } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { fishing } from "@/lib/gamedata/fishing";
import { misc } from "@/lib/gamedata/misc";
import type { Fish } from "@/lib/gamedata/types";
import { dbHref, sectionHref, productHref } from "@/lib/db/routes";
import { core } from "@/lib/gamedata";
import {
  chapterOfSection,
  Chip,
  Chips,
  Detail,
  directed,
  Empty,
  matches,
  nameOf,
  Ref,
  Row,
  Section,
  Segments,
  SortChips,
  StickyBar,
  type SortDir,
} from "./kit";

const TABS = ["fish", "tackle", "breeding", "contests"] as const;
const sectionById = new Map(core.sections.map((s) => [s.id, s]));
const dungeonChapter = new Map(core.dungeons.map((d) => [d.id, d.chapterNumber]));
/** The earliest chapter a fish bites somewhere (town waters count from chapter 1). */
const fishChapter = (f: Fish) =>
  Math.min(
    ...f.habitats.map((h) =>
      h.sectionId
        ? (chapterOfSection(h.sectionId) ?? 9)
        : h.dungeonId
          ? (dungeonChapter.get(h.dungeonId) ?? 9)
          : 1,
    ),
  );
type Tab = (typeof TABS)[number];

type Habitat = Fish["habitats"][number];

/** Fish, tackle, feeding, breeding, the rod and the contests, from the game data. */
export function FishingPage() {
  const t = useTranslations();
  const [tab, setTab] = useQueryChoice<Tab>("tab", TABS, "fish");
  const [sort, setSort] = useQueryChoice("sort", ["chapter", "name"], "chapter");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();

  const where = (h: Habitat) => {
    const place = h.sectionId
      ? t("fishing.inChapter", {
          place: nameOf("sections", h.sectionId),
          n: chapterOfSection(h.sectionId) ?? "?",
        })
      : h.dungeonId
        ? nameOf("dungeons", h.dungeonId)
        : nameOf("towns", h.townId);
    const hours =
      h.fromHour != null && h.toHour != null
        ? t("fishing.hours", { from: h.fromHour, to: h.toHour })
        : "";
    return [place, h.spot, hours].filter(Boolean).join(" · ");
  };

  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("fishing.search")} value={q} onChange={setQ}>
        <Segments
          label={t("nav.fishing")}
          value={tab}
          onChange={setTab}
          options={TABS.map((v) => ({ value: v, label: t(`fishing.tab.${v}` as const) }))}
        />
        {tab === "fish" && (
          <SortChips
            value={sort}
            onChange={setSort}
            dir={dir}
            onDir={setDir}
            options={(["chapter", "name"] as const).map((v) => ({
              value: v,
              label: t(`db.sort.${v}` as const),
            }))}
          />
        )}
      </StickyBar>
      {tab === "fish" && <FishTab needle={needle} where={where} sort={sort} dir={dir} />}
      {tab === "tackle" && <TackleTab needle={needle} />}
      {tab === "breeding" && <BreedingTab needle={needle} />}
      {tab === "contests" && <RodTab needle={needle} />}
    </Gate>
  );
}

function FishTab({
  needle,
  where,
  sort,
  dir,
}: {
  needle: string;
  where: (h: Habitat) => string;
  sort: "chapter" | "name";
  dir: SortDir;
}) {
  const t = useTranslations();
  const trophyOf = new Map(misc.trophies.filter((x) => x.fishId).map((x) => [x.fishId!, x]));
  const shown = fishing.fish
    .filter((f) =>
      matches(
        needle,
        f.name,
        ...f.habitats.map(where),
        ...f.tackle.map((id) => nameOf("items", id)),
      ),
    )
    .sort(
      directed(
        (a, b) =>
          (sort === "chapter" ? fishChapter(a) - fishChapter(b) : 0) ||
          a.name.localeCompare(b.name),
        dir,
      ),
    );
  if (!shown.length) return <Empty>{t("reference.noMatch")}</Empty>;
  return (
    <Section title={t("fishing.tab.fish")} meta={t("reference.count", { n: shown.length })}>
      {shown.map((f) => {
        const trophy = trophyOf.get(f.id);
        return (
          <Row
            key={f.id}
            title={<Ref href={dbHref("fish", f.id)}>{f.name}</Ref>}
            aside={trophy && <Chip tone="accent">{t(`trophy.${trophy.tier}` as const)}</Chip>}
          >
            {f.habitats.map((h, i) => (
              <Detail key={i}>
                {h.sectionId && sectionById.get(h.sectionId) ? (
                  <Ref href={sectionHref(sectionById.get(h.sectionId)!)}>{where(h)}</Ref>
                ) : h.dungeonId ? (
                  <Ref href={dbHref("dungeon", h.dungeonId)}>{where(h)}</Ref>
                ) : h.townId ? (
                  <Ref href={dbHref("town", h.townId)}>{where(h)}</Ref>
                ) : (
                  where(h)
                )}
              </Detail>
            ))}
            {f.rejectIn && (
              <Detail>
                {t("fishing.rejects", { water: t(`fishing.water.${f.rejectIn}` as const) })}
              </Detail>
            )}
            {f.tackle.length > 0 && (
              <Chips>
                {f.tackle.map((id) => (
                  <Chip key={id}>
                    <Ref href={dbHref("item", id)}>{nameOf("items", id)}</Ref>
                  </Chip>
                ))}
              </Chips>
            )}
            {trophy && <Detail>{t("fishing.trophy", { name: trophy.name })}</Detail>}
          </Row>
        );
      })}
    </Section>
  );
}

function TackleTab({ needle }: { needle: string }) {
  const t = useTranslations();
  const attracts = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of fishing.fish)
      for (const id of f.tackle) m.set(id, [...(m.get(id) ?? []), f.name]);
    return m;
  }, []);
  const feed = (id: string) => fishing.feedEffects.filter((e) => e.itemId === id);
  const rows = fishing.tackle.filter((x) =>
    matches(needle, nameOf("items", x.itemId), ...(attracts.get(x.itemId) ?? [])),
  );
  const group = (type: "bait" | "lure") => rows.filter((x) => x.type === type);
  if (!rows.length) return <Empty>{t("reference.noMatch")}</Empty>;
  return (
    <>
      {(["bait", "lure"] as const).map(
        (type) =>
          group(type).length > 0 && (
            <Section key={type} title={t(`fishing.${type}s` as const)}>
              {group(type).map((x) => (
                <Row
                  key={x.itemId}
                  title={<Ref href={dbHref("item", x.itemId)}>{nameOf("items", x.itemId)}</Ref>}
                  aside={
                    x.water && <Chip tone="dashed">{t(`fishing.bait.${x.water}` as const)}</Chip>
                  }
                >
                  {(attracts.get(x.itemId) ?? []).length > 0 && (
                    <Detail>
                      {t("fishing.attracts")} {(attracts.get(x.itemId) ?? []).join(", ")}
                    </Detail>
                  )}
                  {feed(x.itemId).length > 0 && (
                    <Chips>
                      {feed(x.itemId).map((e) => (
                        <Chip key={e.stat} tone={e.change === "lower" ? "bad" : "good"}>
                          {t(`fishing.feed.${e.change}` as const, {
                            stat: t(`fishing.stat.${e.stat}` as const),
                          })}
                        </Chip>
                      ))}
                    </Chips>
                  )}
                </Row>
              ))}
            </Section>
          ),
      )}
      <p className="text-muted-foreground text-xs">{t("fishing.feedNote")}</p>
    </>
  );
}

function BreedingTab({ needle }: { needle: string }) {
  const t = useTranslations();
  // By the fish that comes out: every pair that can produce it.
  const byChild = useMemo(() => {
    const m = new Map<string, [string, string][]>();
    for (const b of fishing.breeding)
      m.set(b.childId, [...(m.get(b.childId) ?? []), [b.parentAId, b.parentBId]]);
    return [...m].sort((a, b) => nameOf("fish", a[0]).localeCompare(nameOf("fish", b[0])));
  }, []);
  const shown = byChild
    .map(
      ([child, pairs]) =>
        [
          child,
          matches(needle, nameOf("fish", child))
            ? pairs
            : pairs.filter(([a, b]) => matches(needle, nameOf("fish", a), nameOf("fish", b))),
        ] as const,
    )
    .filter(([, pairs]) => pairs.length > 0);
  if (!shown.length) return <Empty>{t("reference.noMatch")}</Empty>;
  return (
    <>
      <p className="text-muted-foreground text-sm">{t("fishing.breedingIntro")}</p>
      <Section title={t("fishing.tab.breeding")}>
        {shown.map(([child, pairs]) => (
          <Row
            key={child}
            title={<Ref href={dbHref("fish", child)}>{nameOf("fish", child)}</Ref>}
            aside={t("fishing.pairs", { n: pairs.length })}
          >
            <Detail>
              {pairs.map(([a, b], i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <Ref href={dbHref("fish", a)}>{nameOf("fish", a)}</Ref> ×{" "}
                  <Ref href={dbHref("fish", b)}>{nameOf("fish", b)}</Ref>
                </span>
              ))}
            </Detail>
          </Row>
        ))}
      </Section>
    </>
  );
}

function RodTab({ needle }: { needle: string }) {
  const t = useTranslations();
  const prize = (p: FishingPrize, i: number) => (
    <span key={i}>
      {i > 0 && ", "}
      {p.quantity > 1 ? `${p.quantity}× ` : ""}
      <Ref href={productHref(p)}>
        {p.weaponId ? nameOf("weapons", p.weaponId) : nameOf("items", p.itemId)}
      </Ref>
    </span>
  );
  return (
    <>
      <Section title={t("fishing.rod")}>
        {fishing.rodStats
          .filter((s) => matches(needle, s.name, s.description))
          .map((s) => (
            <Row
              key={s.id}
              title={s.name}
              aside={
                <>
                  <span>{t("fishing.rodStart", { n: s.startValue })}</span>
                  <span className="text-muted-foreground">
                    {t("fishing.fpPerPoint", { n: s.fpPerPoint })}
                  </span>
                </>
              }
            >
              {s.description && <Detail>{s.description}</Detail>}
            </Row>
          ))}
      </Section>
      {fishing.contests.map((c) => {
        const classes = c.classes.length ? c.classes : [{ id: 0, name: "", position: 0 }];
        return (
          <Section
            key={c.id}
            title={c.name}
            meta={[
              nameOf("towns", c.townId),
              c.fromChapterNumber && t("reference.fromChapter", { n: c.fromChapterNumber }),
              c.intervalDays &&
                t("fishing.every", { n: c.intervalDays, hours: c.durationHours ?? "?" }),
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            {classes.map((cl) => {
              const prizes = c.prizes.filter((p) => (cl.id ? p.classId === cl.id : true));
              const places = [...new Set(prizes.map((p) => p.place))].sort((a, b) => a - b);
              return (
                <Row key={cl.id} title={cl.name || t(`fishing.contest.${c.type}` as const)}>
                  {places.map((place) => {
                    const at = prizes.filter((p) => p.place === place);
                    const first = at.filter((p) => p.prizeSet === "first-win");
                    const pool = at.filter((p) => p.prizeSet === "pool");
                    return (
                      <Detail key={place}>
                        <span className="text-foreground font-semibold">
                          {t("fishing.place", { n: place })}
                        </span>{" "}
                        {first.length > 0 && (
                          <>
                            {t("fishing.firstWin")} {first.map(prize)}
                          </>
                        )}
                        {first.length > 0 && pool.length > 0 && " · "}
                        {pool.length > 0 && (
                          <>
                            {t("fishing.pool")} {pool.map(prize)}
                          </>
                        )}
                      </Detail>
                    );
                  })}
                </Row>
              );
            })}
          </Section>
        );
      })}
    </>
  );
}

type FishingPrize = (typeof fishing.contests)[number]["prizes"][number];
