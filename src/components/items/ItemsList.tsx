import { useMemo, useState } from "react";
import { InfoIcon } from "lucide-react";
import { STAT_KEYS, type StatKey } from "@/lib/schemas";
import { AddToListButton } from "@/components/shopping/AddToListButton";
import { useTranslations } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { dbHref, ITEM_TABS, type ItemTab } from "@/lib/db/routes";
import type { ItemRow } from "@/lib/db/lists";
import {
  Chip,
  Chips,
  directed,
  Empty,
  FilterChips,
  Ref,
  Row,
  Section,
  Segments,
  SortChips,
  StickyBar,
  type SortDir,
} from "@/components/db/kit";

type Get = "all" | "buyable" | "found";
const SORTS = ["chapter", "name", "price", "gain"] as const;
type Sort = (typeof SORTS)[number];
const LAST = 99;

const inTab = (r: ItemRow, tab: ItemTab) =>
  tab === "all" || r.tab === tab || (tab === "synth" && r.synth);

/**
 * Every item: what it does and how to get it. Tabs by kind; Synth adds the "gives" stat filter.
 * Sorted by the chapter it can first be had, lowest first.
 */
export function ItemsList({ rows }: { rows: ItemRow[] }) {
  const t = useTranslations();
  const [tab, setTab] = useQueryChoice<ItemTab>("tab", ITEM_TABS, "all");
  const [get, setGet] = useQueryChoice<Get>("kind", ["all", "buyable", "found"], "all");
  const [gives, setGives] = useQueryChoice<StatKey | "">("gives", ["", ...STAT_KEYS], "");
  const [sort, setSort] = useQueryChoice<Sort>("sort", SORTS, "chapter");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const [q, setQ] = useQueryText("q");
  const [showNote, setShowNote] = useState(false);
  const needle = q.trim().toLowerCase();
  // A stat filter only makes sense for synth items; picking one switches there.
  const pickGives = (k: StatKey | "") => {
    setGives(k);
    if (k && tab !== "synth" && tab !== "all") setTab("synth");
  };
  const sortBy: Sort = sort === "gain" && !gives ? "chapter" : sort;

  const counts = useMemo(
    () => Object.fromEntries(ITEM_TABS.map((x) => [x, rows.filter((r) => inTab(r, x)).length])),
    [rows],
  );

  const shown = useMemo(() => {
    const cmp: Record<Sort, (a: ItemRow, b: ItemRow) => number> = {
      chapter: (a, b) =>
        (a.chapter ?? LAST) - (b.chapter ?? LAST) || (a.price ?? 0) - (b.price ?? 0),
      name: () => 0,
      price: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
      gain: (a, b) => (gives ? (a.gains[gives] ?? 0) - (b.gains[gives] ?? 0) : 0),
    };
    const order = (a: ItemRow, b: ItemRow) => cmp[sortBy](a, b) || a.name.localeCompare(b.name);
    return rows
      .filter((r) => inTab(r, tab))
      .filter((r) => get === "all" || (get === "buyable" ? r.price != null : r.price == null))
      .filter((r) => !gives || (r.gains[gives] ?? 0) > 0)
      .filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          r.effects.some((e) => e.toLowerCase().includes(needle)),
      )
      .sort(directed(order, dir));
  }, [rows, tab, get, gives, needle, sortBy, dir]);

  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <div className="flex items-start gap-2">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">{t("items.introShort")}</p>
        <button
          type="button"
          aria-expanded={showNote}
          aria-label={t("items.noteLabel")}
          onClick={() => setShowNote(!showNote)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <InfoIcon className="size-4" />
        </button>
      </div>
      {showNote && (
        <p className="bg-card text-muted-foreground rounded-md border-2 px-3 py-2 text-xs">
          {t("items.note")}
        </p>
      )}

      <StickyBar label={t("items.search")} value={q} onChange={setQ}>
        <Segments
          label={t("items.title")}
          value={tab}
          onChange={setTab}
          options={ITEM_TABS.map((x) => ({
            value: x,
            label: (
              <>
                {t(`items.tab.${x}` as const)} <span className="tabular-nums">{counts[x]}</span>
              </>
            ),
          }))}
        />
        <FilterChips
          label={t("items.get")}
          value={get}
          onChange={setGet}
          options={(["all", "buyable", "found"] as const).map((g) => ({
            value: g,
            label: t(`items.seg.${g}` as const),
          }))}
        />
        {(tab === "synth" || tab === "all") && (
          <FilterChips
            label={t("items.gives")}
            value={gives}
            onChange={pickGives}
            clearable
            options={[
              { value: "" as const, label: t("items.anyStat") },
              ...STAT_KEYS.map((k) => ({ value: k, label: t(`stat.${k}` as const) })),
            ]}
          />
        )}
        <SortChips
          value={sortBy}
          onChange={setSort}
          dir={dir}
          onDir={setDir}
          options={SORTS.filter((s) => s !== "gain" || gives).map((s) => ({
            value: s,
            label: t(`items.sort.${s}` as const),
          }))}
        />
      </StickyBar>

      {shown.length === 0 ? (
        <Empty>{t("items.noMatch")}</Empty>
      ) : (
        <Section
          title={
            gives
              ? t("items.givesList", { stat: t(`stat.${gives}` as const) })
              : t(`items.tab.${tab}` as const)
          }
          meta={t("reference.count", { n: shown.length })}
        >
          {shown.map((r) => (
            <ItemListRow key={r.id} row={r} gives={gives || undefined} />
          ))}
        </Section>
      )}
    </Gate>
  );
}

function ItemListRow({ row: r, gives }: { row: ItemRow; gives?: StatKey }) {
  const t = useTranslations();
  const gains = (Object.entries(r.gains) as [StatKey | "du", number][]).sort(([a], [b]) =>
    a === gives ? -1 : b === gives ? 1 : 0,
  );
  const extra = gains.length > 3 ? gains.length - 3 : 0;
  return (
    <Row
      title={<Ref href={dbHref("item", r.id)}>{r.name}</Ref>}
      aside={
        <>
          {r.price != null ? (
            <>
              <span className="font-semibold">
                {t("items.gilda", { n: r.price.toLocaleString("en") })}
              </span>
              <span className="text-muted-foreground">
                {t("items.fromChapter", { n: r.priceChapter ?? 1 })}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {r.chapter ? t("items.fromChapter", { n: r.chapter }) : t("items.foundOnly")}
            </span>
          )}
          <span className="mt-1">
            <AddToListButton name={r.name} goal={{ kind: "item", name: r.name }} />
          </span>
        </>
      }
    >
      {(gains.length > 0 || r.ability || r.effects.length > 0) && (
        <Chips>
          {gains.slice(0, 3).map(([k, v]) => (
            <Chip key={k} tone={k === gives ? "accent" : k === "du" ? "dashed" : "plain"}>
              {t(`stat.short.${k}` as const)} +{v}
            </Chip>
          ))}
          {extra > 0 && (
            <span className="text-muted-foreground px-1 py-0.5 text-[11px]">
              {t("items.more", { n: extra })}
            </span>
          )}
          {r.ability && <Chip tone="good">{t(`ability.${r.ability}` as "ability.abs-up")}</Chip>}
          {r.effects.slice(0, 2).map((e) => (
            <Chip key={e} tone="good">
              {e}
            </Chip>
          ))}
        </Chips>
      )}
      {r.sources.length > 0 && (
        <span className="text-muted-foreground text-[11px]">
          {r.sources.map((s) => t(`db.src.${s}` as const)).join(" · ")}
        </span>
      )}
    </Row>
  );
}
