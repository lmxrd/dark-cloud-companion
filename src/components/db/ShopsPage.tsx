import { useTranslations } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { dbHref } from "@/lib/db/routes";
import type { ShopRow } from "@/lib/db/lists";
import { Detail, Empty, FilterChips, matches, Ref, Row, Section, StickyBar } from "./kit";

const CHAPTERS = ["", "1", "2", "3", "4", "5", "6", "7", "8"] as const;

/**
 * Every shop and seller by town, by name. "Open in chapter" keeps what can be bought by then; a
 * search finds a shop or anything it sells.
 */
export function ShopsPage({
  rows,
  towns,
}: {
  rows: ShopRow[];
  towns: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const [q, setQ] = useQueryText("q");
  const [chapter, setChapter] = useQueryChoice("chapter", CHAPTERS, "");
  const needle = q.trim().toLowerCase();
  const by = chapter ? Number(chapter) : undefined;

  const visible = rows
    .filter((s) => !by || s.chapter <= by)
    .map((s) => {
      const stock = s.stock.filter(
        (x) => !by || ((x.chapter ?? s.chapter) <= by && (!x.until || x.until >= by)),
      );
      const hits = matches(needle, s.name, s.keeper)
        ? []
        : stock.filter((x) => matches(needle, x.name));
      return { s, stock, hits, show: matches(needle, s.name, s.keeper) || hits.length > 0 };
    })
    .filter((v) => v.show && v.stock.length > 0)
    .sort((a, b) => a.s.name.localeCompare(b.s.name));

  const groups = [...towns, { id: "", name: t("shops.sellers") }]
    .map((tw) => ({ ...tw, list: visible.filter((v) => (v.s.townId ?? "") === tw.id) }))
    .filter((g) => g.list.length > 0);

  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("shops.search")} value={q} onChange={setQ}>
        <FilterChips
          label={t("db.openIn")}
          value={chapter}
          onChange={setChapter}
          options={CHAPTERS.map((c) => ({ value: c, label: c || t("db.anyChapter") }))}
        />
      </StickyBar>
      {groups.length === 0 && <Empty>{t("reference.noMatch")}</Empty>}
      {groups.map((g) => (
        <Section
          key={g.id || "sellers"}
          title={g.id ? <Ref href={dbHref("town", g.id)}>{g.name}</Ref> : g.name}
          meta={t("reference.count", { n: g.list.length })}
        >
          {g.list.map(({ s, stock, hits }) => (
            <Row
              key={s.id}
              title={<Ref href={dbHref("shop", s.id)}>{s.name}</Ref>}
              aside={
                <span className="text-muted-foreground">
                  {t("db.thingsN", { n: stock.length })}
                </span>
              }
            >
              <Detail>
                {[
                  s.keeper,
                  s.chapter > 1 && t("reference.fromChapter", { n: s.chapter }),
                  s.currency !== "gilda" && t(`db.currency.${s.currency}` as const),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Detail>
              {hits.length > 0 && <Detail>{hits.map((x) => x.name).join(", ")}</Detail>}
            </Row>
          ))}
        </Section>
      ))}
    </Gate>
  );
}
