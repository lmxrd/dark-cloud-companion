import { useMemo } from "react";
import { useTranslations } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { useChecks } from "@/lib/useAppStore";
import { tick } from "@/lib/gamedata/ticks";
import { dbHref } from "@/lib/db/routes";
import type { PersonRow } from "@/lib/db/lists";
import {
  Chip,
  directed,
  Detail,
  Empty,
  FilterChips,
  matches,
  Ref,
  Row,
  Section,
  SortChips,
  StickyBar,
  type SortDir,
} from "./kit";

const SORTS = ["recruit", "name"] as const;
type Sort = (typeof SORTS)[number];

/** Everyone: home town, support skills and the chapter they can be recruited in. */
export function PeoplePage({
  rows,
  towns,
}: {
  rows: PersonRow[];
  towns: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const checks = useChecks();
  const [q, setQ] = useQueryText("q");
  const townIds = useMemo(() => ["", ...towns.map((x) => x.id)], [towns]);
  const [town, setTown] = useQueryChoice("town", townIds, "");
  const [sort, setSort] = useQueryChoice<Sort>("sort", SORTS, "recruit");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((n) => !town || n.townId === town)
    .filter((n) => matches(needle, n.name, n.town, n.quest, ...n.skills))
    .sort(
      directed(
        (a, b) =>
          (sort === "recruit" ? (a.chapter ?? 99) - (b.chapter ?? 99) : 0) ||
          a.name.localeCompare(b.name),
        dir,
      ),
    );
  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("people.search")} value={q} onChange={setQ}>
        <FilterChips
          label={t("db.town")}
          value={town}
          onChange={setTown}
          options={[
            { value: "", label: t("db.anyTown") },
            ...towns.map((x) => ({ value: x.id, label: x.name })),
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
        <Section title={t("nav.people")} meta={t("reference.count", { n: shown.length })}>
          {shown.map((n) => (
            <Row
              key={n.id}
              title={<Ref href={dbHref("npc", n.id)}>{n.name}</Ref>}
              aside={
                n.chapter != null && (
                  <>
                    <span>{t("reference.chapterShort", { n: n.chapter })}</span>
                    {checks[tick.recruit(n.id)] && <Chip tone="accent">✓ {t("db.recruited")}</Chip>}
                  </>
                )
              }
            >
              <Detail>{[n.town, ...n.skills].filter(Boolean).join(" · ")}</Detail>
            </Row>
          ))}
        </Section>
      )}
    </Gate>
  );
}
