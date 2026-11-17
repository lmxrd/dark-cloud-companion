import { useMemo } from "react";
import { useTranslations } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { dbHref } from "@/lib/db/routes";
import type { EnemyRow } from "@/lib/db/lists";
import {
  directed,
  Empty,
  FilterChips,
  Ref,
  Row,
  Section,
  Segments,
  SortChips,
  StickyBar,
  Detail,
  type SortDir,
} from "./kit";

const TYPES = ["all", "normal", "sub-boss", "boss", "mimic"] as const;
type TypeFilter = (typeof TYPES)[number];
const SORTS = ["number", "chapter", "hp", "abs", "name"] as const;
type Sort = (typeof SORTS)[number];

/** Every enemy, by Monster Notes number; filter by type and dungeon. */
export function BestiaryPage({
  rows,
  dungeons,
}: {
  rows: EnemyRow[];
  /** Dungeons in story order, for the filter. */
  dungeons: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const [type, setType] = useQueryChoice<TypeFilter>("type", TYPES, "all");
  const dungeonIds = useMemo(() => ["", "none", ...dungeons.map((d) => d.id)], [dungeons]);
  const [dungeon, setDungeon] = useQueryChoice("dungeon", dungeonIds, "");
  const [sort, setSort] = useQueryChoice<Sort>("sort", SORTS, "number");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();

  const shown = useMemo(() => {
    const val: Record<Sort, (e: EnemyRow) => number> = {
      number: (e) => e.number ?? 9999,
      chapter: (e) => e.chapter ?? 99,
      hp: (e) => e.hp ?? 0,
      abs: (e) => e.abs ?? 0,
      name: () => 0,
    };
    const cmp = (a: EnemyRow, b: EnemyRow) =>
      val[sort](a) - val[sort](b) || a.name.localeCompare(b.name);
    return rows
      .filter((e) => type === "all" || e.type === type)
      .filter((e) => !dungeon || e.dungeons.includes(dungeon === "none" ? "" : dungeon))
      .filter(
        (e) =>
          !needle ||
          [e.name, e.variant, e.className, e.search].some((s) => s?.toLowerCase().includes(needle)),
      )
      .sort(directed(cmp, dir));
  }, [rows, type, dungeon, needle, sort, dir]);

  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("bestiary.search")} value={q} onChange={setQ}>
        <Segments
          label={t("bestiary.type")}
          value={type}
          onChange={setType}
          options={TYPES.map((v) => ({ value: v, label: t(`bestiary.type.${v}` as const) }))}
        />
        <FilterChips
          label={t("db.dungeon")}
          value={dungeon}
          onChange={setDungeon}
          options={[
            { value: "", label: t("db.anyDungeon") },
            ...dungeons.map((d) => ({ value: d.id, label: d.name })),
            { value: "none", label: t("db.notInDungeon") },
          ]}
        />
        <SortChips
          value={sort}
          onChange={setSort}
          dir={dir}
          onDir={setDir}
          options={SORTS.map((s) => ({ value: s, label: t(`db.sort.${s}` as const) }))}
        />
      </StickyBar>
      {shown.length === 0 ? (
        <Empty>{t("reference.noMatch")}</Empty>
      ) : (
        <Section title={t("nav.bestiary")} meta={t("reference.count", { n: shown.length })}>
          {shown.map((e) => (
            <Row
              key={e.id}
              title={
                <>
                  {e.number != null && (
                    <span className="text-muted-foreground mr-1.5 tabular-nums">#{e.number}</span>
                  )}
                  <Ref href={dbHref("enemy", e.id)}>{e.name}</Ref>
                  {e.variant && (
                    <span className="text-muted-foreground font-normal"> · {e.variant}</span>
                  )}
                </>
              }
              aside={
                <>
                  {!!e.abs && (
                    <span className="font-semibold">
                      {t("bestiary.abs", { n: e.abs.toLocaleString("en") })}
                    </span>
                  )}
                  {!!e.gilda && (
                    <span className="text-muted-foreground">
                      {t("items.gilda", { n: e.gilda.toLocaleString("en") })}
                    </span>
                  )}
                </>
              }
            >
              <Detail>
                {[
                  e.type !== "normal" && t(`bestiary.type.${e.type as "boss"}` as const),
                  e.className,
                  e.hp != null && `${t("db.hp")} ${e.hp.toLocaleString("en")}`,
                  e.chapter && t("reference.chapterShort", { n: e.chapter }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Detail>
            </Row>
          ))}
        </Section>
      )}
    </Gate>
  );
}
