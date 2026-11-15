// The smaller database lists: inventions and photos, Georama parts, places, abilities and trophies.
import { useMemo } from "react";
import { useTranslations } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { useChecks } from "@/lib/useAppStore";
import { setChecked } from "@/lib/store";
import { tick } from "@/lib/gamedata/ticks";
import { CheckRow } from "@/components/chapter/CheckRow";
import { dbHref, sectionHref } from "@/lib/db/routes";
import type {
  AbilityRow,
  GeoramaRow,
  InventionRow,
  PhotoRow,
  PlaceRow,
  TrophyRow,
} from "@/lib/db/lists";
import {
  Chip,
  Chips,
  directed,
  Detail,
  Empty,
  FilterChips,
  matches,
  Ref,
  Row,
  Section,
  Segments,
  SortChips,
  StickyBar,
  type SortDir,
} from "./kit";

const CHAPTERS = ["", "1", "2", "3", "4", "5", "6", "7", "8"] as const;

/** A progress line: "54 / 128 inventions" with a bar. */
function Progress({ items }: { items: { label: string; done: number; total: number }[] }) {
  return (
    <section className="bg-card shadow-sticker grid grid-cols-2 gap-4 rounded-xl border-2 p-4">
      {items.map((x) => {
        const pct = x.total ? Math.round((100 * x.done) / x.total) : 0;
        return (
          <div key={x.label} className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              {x.label}
            </span>
            <span className="font-heading text-2xl font-extrabold tabular-nums">
              {x.done} <span className="text-muted-foreground text-base">/ {x.total}</span>
            </span>
            <div
              className="bg-muted h-2.5 overflow-hidden rounded-full border-2"
              role="progressbar"
              aria-label={x.label}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ─── inventions and photos ────────────────────────────────────────────────────────────────────────

/** Every invention and photo by chapter, with the ticks the dashboard shares. */
export function InventionsPage({
  inventions,
  photos,
}: {
  inventions: InventionRow[];
  photos: PhotoRow[];
}) {
  const t = useTranslations();
  const checks = useChecks();
  const [tab, setTab] = useQueryChoice("tab", ["inventions", "photos"], "inventions");
  const [chapter, setChapter] = useQueryChoice("chapter", CHAPTERS, "");
  const [makes, setMakes] = useQueryChoice("makes", ["", "weapon", "item", "ridepod"], "");
  const [kind, setKind] = useQueryChoice("type", ["", "idea", "scoop"], "");
  const [sort, setSort] = useQueryChoice("sort", ["chapter", "name"], "chapter");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();
  const byChapter = <T extends { chapter?: number; name: string }>(a: T, b: T) =>
    (sort === "chapter" ? (a.chapter ?? 99) - (b.chapter ?? 99) : 0) ||
    a.name.localeCompare(b.name);

  const invShown = inventions
    .filter((v) => !chapter || v.chapter === Number(chapter))
    .filter((v) => !makes || v.makes === makes)
    .filter((v) => matches(needle, v.name, ...v.ideas))
    .sort(directed(byChapter, dir));
  const photoShown = photos
    .filter((p) => !chapter || p.chapter === Number(chapter))
    .filter((p) => !kind || p.type === kind)
    .filter((p) => matches(needle, p.name, p.place))
    .sort(directed(byChapter, dir));
  const done = (ids: string[]) => ids.filter((id) => checks[id]).length;

  return (
    <Gate on={["url", "state"]} className="flex flex-col gap-5">
      <Progress
        items={[
          {
            label: t("db.tab.inventions"),
            done: done(inventions.map((v) => tick.invention(v.id))),
            total: inventions.length,
          },
          {
            label: t("db.tab.photos"),
            done: done(photos.map((p) => tick.photo(p.id))),
            total: photos.length,
          },
        ]}
      />
      <StickyBar label={t("db.searchInventions")} value={q} onChange={setQ}>
        <Segments
          label={t("nav.inventions")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "inventions", label: t("db.tab.inventions") },
            { value: "photos", label: t("db.tab.photos") },
          ]}
        />
        <FilterChips
          label={t("db.chapter")}
          value={chapter}
          onChange={setChapter}
          options={CHAPTERS.map((c) => ({ value: c, label: c || t("db.any") }))}
        />
        {tab === "inventions" ? (
          <FilterChips
            label={t("db.makesFilter")}
            value={makes}
            onChange={setMakes}
            options={(["", "weapon", "item", "ridepod"] as const).map((m) => ({
              value: m,
              label: m ? t(`db.makes.${m}` as const) : t("db.any"),
            }))}
          />
        ) : (
          <FilterChips
            label={t("db.photoKind")}
            value={kind}
            onChange={setKind}
            options={(["", "idea", "scoop"] as const).map((m) => ({
              value: m,
              label: m ? t(`db.photoType.${m}` as const) : t("db.any"),
            }))}
          />
        )}
        <SortChips
          value={sort}
          onChange={setSort}
          dir={dir}
          onDir={setDir}
          options={(["chapter", "name"] as const).map((s) => ({
            value: s,
            label: t(`db.sort.${s}` as const),
          }))}
        />
      </StickyBar>
      {tab === "inventions" ? (
        invShown.length === 0 ? (
          <Empty>{t("reference.noMatch")}</Empty>
        ) : (
          <Section
            title={t("db.tab.inventions")}
            meta={t("reference.count", { n: invShown.length })}
          >
            {invShown.map((v) => (
              <li key={v.id}>
                <CheckRow
                  dense
                  checked={!!checks[tick.invention(v.id)]}
                  onChange={(on) => setChecked(tick.invention(v.id), on)}
                  label={<Ref href={dbHref("invention", v.id)}>{v.name}</Ref>}
                  badges={<Chip tone="dashed">{t(`db.makes.${v.makes}` as const)}</Chip>}
                  detail={v.ideas.join(" + ")}
                  aside={v.chapter && t("reference.chapterShort", { n: v.chapter })}
                />
              </li>
            ))}
          </Section>
        )
      ) : photoShown.length === 0 ? (
        <Empty>{t("reference.noMatch")}</Empty>
      ) : (
        <Section title={t("db.tab.photos")} meta={t("reference.count", { n: photoShown.length })}>
          {photoShown.map((p) => (
            <li key={p.id}>
              <CheckRow
                dense
                checked={!!checks[tick.photo(p.id)]}
                onChange={(on) => setChecked(tick.photo(p.id), on)}
                label={<Ref href={dbHref("photo", p.id)}>{p.name}</Ref>}
                badges={
                  <>
                    <Chip tone="dashed">{t(`db.photoType.${p.type}` as const)}</Chip>
                    {p.missable && <Chip tone="bad">{t("db.missable")}</Chip>}
                  </>
                }
                detail={[p.place, p.usedIn > 0 && t("db.usedInN", { n: p.usedIn })]
                  .filter(Boolean)
                  .join(" · ")}
                aside={
                  <>
                    <span className="block">{t("db.pointsN", { n: p.points })}</span>
                    {p.chapter && (
                      <span className="text-muted-foreground block">
                        {t("reference.chapterShort", { n: p.chapter })}
                      </span>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </Section>
      )}
    </Gate>
  );
}

// ─── Georama ──────────────────────────────────────────────────────────────────────────────────────

/** Georama parts, cheapest first; filter by town and placement. */
export function GeoramaPage({
  rows,
  towns,
}: {
  rows: GeoramaRow[];
  towns: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const townIds = useMemo(() => ["", ...towns.map((x) => x.id)], [towns]);
  const [town, setTown] = useQueryChoice("town", townIds, "");
  const [placement, setPlacement] = useQueryChoice(
    "placement",
    ["", "ground", "house", "wall", "roof"],
    "",
  );
  const [sort, setSort] = useQueryChoice("sort", ["polyn", "name"], "polyn");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((p) => !town || p.towns.includes(town))
    .filter((p) => !placement || p.placement === placement)
    .filter((p) => matches(needle, p.name, ...p.materials.map((m) => m.name)))
    .sort(
      directed(
        (a, b) =>
          (sort === "polyn" ? (a.polyn ?? 0) - (b.polyn ?? 0) : 0) || a.name.localeCompare(b.name),
        dir,
      ),
    );
  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("db.searchGeorama")} value={q} onChange={setQ}>
        <FilterChips
          label={t("db.town")}
          value={town}
          onChange={setTown}
          options={[
            { value: "", label: t("db.anyTown") },
            ...towns.map((x) => ({ value: x.id, label: x.name })),
          ]}
        />
        <FilterChips
          label={t("db.placementFilter")}
          value={placement}
          onChange={setPlacement}
          options={(["", "ground", "house", "wall", "roof"] as const).map((p) => ({
            value: p,
            label: p ? t(`db.placement.${p}` as const) : t("db.any"),
          }))}
        />
        <SortChips
          value={sort}
          onChange={setSort}
          dir={dir}
          onDir={setDir}
          options={(["polyn", "name"] as const).map((s) => ({
            value: s,
            label: t(`db.sort.${s}` as const),
          }))}
        />
      </StickyBar>
      {shown.length === 0 ? (
        <Empty>{t("reference.noMatch")}</Empty>
      ) : (
        <Section title={t("db.georamaParts")} meta={t("reference.count", { n: shown.length })}>
          {shown.map((p) => (
            <Row
              key={p.id}
              title={<Ref href={dbHref("georamaPart", p.id)}>{p.name}</Ref>}
              aside={
                <>
                  {p.polyn != null && (
                    <span className="font-semibold">{t("db.polynN", { n: p.polyn })}</span>
                  )}
                  {!!p.culture && (
                    <span className="text-muted-foreground">
                      {t("db.cultureN", { n: p.culture })}
                    </span>
                  )}
                </>
              }
            >
              <Detail>{p.materials.map((m) => `${m.quantity}× ${m.name}`).join(", ")}</Detail>
            </Row>
          ))}
        </Section>
      )}
    </Gate>
  );
}

// ─── places ───────────────────────────────────────────────────────────────────────────────────────

/** Towns, each with its dungeons and their floors. */
export function PlacesPage({ rows }: { rows: PlaceRow[] }) {
  const t = useTranslations();
  const [era, setEra] = useQueryChoice("era", ["present", "future"], "present");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((tw) => tw.era === era || !!needle)
    .map((tw) => ({
      ...tw,
      dungeons: tw.dungeons
        .map((d) => ({
          ...d,
          floors: matches(needle, tw.name, d.name)
            ? d.floors
            : d.floors.filter((f) => matches(needle, f.title)),
        }))
        .filter((d) => matches(needle, tw.name, d.name) || d.floors.length > 0),
    }))
    .filter((tw) => matches(needle, tw.name) || tw.dungeons.length > 0);
  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("db.searchPlaces")} value={q} onChange={setQ}>
        <Segments
          label={t("db.era")}
          value={era}
          onChange={setEra}
          options={(["present", "future"] as const).map((e) => ({
            value: e,
            label: t(`db.era.${e}` as const),
          }))}
        />
      </StickyBar>
      {shown.length === 0 && <Empty>{t("reference.noMatch")}</Empty>}
      {shown.map((tw) => (
        <section key={tw.id} className="flex flex-col gap-2">
          <h2 className="font-heading flex items-baseline justify-between gap-2 text-lg font-extrabold tracking-tight">
            <Ref href={dbHref("town", tw.id)}>{tw.name}</Ref>
            <span className="text-muted-foreground text-xs font-normal">
              {[tw.georama && t("db.georama"), tw.shops > 0 && t("db.shopsN", { n: tw.shops })]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </h2>
          {tw.dungeons.map((d) => (
            <details
              key={d.id}
              open={!!needle}
              className="bg-card group overflow-hidden rounded-lg border-2"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  <Ref href={dbHref("dungeon", d.id)}>{d.name}</Ref>
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t("db.floorsN", { n: d.floors.length })} ·{" "}
                  {t("reference.chapterShort", { n: d.chapter ?? "?" })}
                </span>
                <span
                  aria-hidden
                  className="text-muted-foreground transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <ul className="flex flex-col divide-y-2 border-t-2">
                {d.floors.map((f) => (
                  <Row
                    key={f.id}
                    title={
                      <Ref href={sectionHref({ id: f.id, type: f.type, chapterNumber: f.chapter })}>
                        {f.title}
                      </Ref>
                    }
                    aside={
                      f.abs ? (
                        <span className="text-muted-foreground">{t("db.absN", { n: f.abs })}</span>
                      ) : undefined
                    }
                  >
                    {f.type === "boss" && <Detail>{t("section.kind.boss")}</Detail>}
                  </Row>
                ))}
              </ul>
            </details>
          ))}
        </section>
      ))}
    </Gate>
  );
}

// ─── abilities ────────────────────────────────────────────────────────────────────────────────────

export function AbilitiesPage({ rows }: { rows: AbilityRow[] }) {
  const t = useTranslations();
  return (
    <Section title={t("nav.abilities")} meta={t("reference.count", { n: rows.length })}>
      {rows.map((a) => (
        <Row
          key={a.id}
          title={<Ref href={dbHref("ability", a.id)}>{a.name}</Ref>}
          aside={
            <span className="text-muted-foreground">{t("db.weaponsN", { n: a.weapons })}</span>
          }
        >
          {a.description && <Detail>{a.description}</Detail>}
          {a.items.length > 0 && (
            <Chips>
              {a.items.map((i) => (
                <Chip key={i.id}>
                  <Ref href={dbHref("item", i.id)}>{i.name}</Ref>
                </Chip>
              ))}
            </Chips>
          )}
        </Row>
      ))}
    </Section>
  );
}

// ─── trophies ─────────────────────────────────────────────────────────────────────────────────────

const TIERS = ["bronze", "silver", "gold", "platinum"] as const;
const tierRank = (tier: string) => TIERS.indexOf(tier as (typeof TIERS)[number]);

/** Every trophy, lowest tier first, with links to what it's about. */
export function TrophiesPage({ rows }: { rows: TrophyRow[] }) {
  const t = useTranslations();
  const [tier, setTier] = useQueryChoice("tier", ["", ...TIERS], "");
  const [sort, setSort] = useQueryChoice("sort", ["tier", "name"], "tier");
  const [dir, setDir] = useQueryChoice<SortDir>("dir", ["asc", "desc"], "asc");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();
  const kindHref = (l: TrophyRow["links"][number]) =>
    l.kind === "enemy"
      ? dbHref("enemy", l.id)
      : l.kind === "fish"
        ? dbHref("fish", l.id)
        : l.kind === "ridepodCore"
          ? dbHref("ridepodCore", l.id)
          : dbHref("weapon", l.id);
  const shown = rows
    .filter((x) => !tier || x.tier === tier)
    .filter((x) => matches(needle, x.name, x.description, ...x.links.map((l) => l.name)))
    .sort(
      directed(
        (a, b) =>
          (sort === "tier" ? tierRank(a.tier) - tierRank(b.tier) || a.position - b.position : 0) ||
          a.name.localeCompare(b.name),
        dir,
      ),
    );
  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("db.searchTrophies")} value={q} onChange={setQ}>
        <Segments
          label={t("db.trophyTier")}
          value={tier}
          onChange={setTier}
          options={(["", ...TIERS] as const).map((x) => ({
            value: x,
            label: x ? t(`trophy.${x}` as const) : t("db.any"),
          }))}
        />
        <SortChips
          value={sort}
          onChange={setSort}
          dir={dir}
          onDir={setDir}
          options={(["tier", "name"] as const).map((s) => ({
            value: s,
            label: t(`db.sort.${s}` as const),
          }))}
        />
      </StickyBar>
      {shown.length === 0 ? (
        <Empty>{t("reference.noMatch")}</Empty>
      ) : (
        <Section title={t("nav.trophies")} meta={t("reference.count", { n: shown.length })}>
          {shown.map((x) => (
            <Row
              key={x.id}
              title={x.name}
              aside={
                <Chip tone={x.tier === "gold" || x.tier === "platinum" ? "accent" : "plain"}>
                  {t(`trophy.${x.tier}` as "trophy.gold")}
                </Chip>
              }
            >
              {x.description && <Detail>{x.description}</Detail>}
              {x.links.length > 0 && (
                <Detail>
                  {x.links.map((l, i) => (
                    <span key={l.kind + l.id}>
                      {i > 0 && ", "}
                      <Ref href={kindHref(l)}>{l.name}</Ref>
                    </span>
                  ))}
                </Detail>
              )}
            </Row>
          ))}
        </Section>
      )}
    </Gate>
  );
}
