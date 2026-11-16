import { useChecks, useProfile } from "@/lib/useAppStore";
import { cn } from "cn";
import { useMemo } from "react";
import { BookOpenIcon, MoreHorizontalIcon, PlusIcon, SearchIcon } from "lucide-react";
import { withBase } from "@/lib/base";
import { useContentTransfer } from "@/components/ContentTransfer";
import { PageHeader } from "@/components/PageHeader";
import { TYPE_ICON } from "@/components/planner/WeaponTypeTabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import { useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { builtinGuides, planVariant, weaponGuides } from "@/lib/guide/builtin";
import { mainWalkthrough } from "@/lib/guide/main";
import { guideProgress } from "@/lib/guide/progress";
import type { Guide } from "@/lib/guide/types";
import { getWeapon } from "@/lib/planner/sources";
import { deriveBuild } from "@/lib/guide/derive";
import { toggleGuide } from "@/lib/store";

const viewHref = (g: Guide) => withBase(`/guides/view?id=${encodeURIComponent(g.id)}`);

/** The weapon a build guide ends in: its last build step's weapon or build-up target. */
function targetOf(g: Guide): string | undefined {
  const last = g.steps.findLast((s) => s.build || s.buildUp);
  return last?.buildUp?.weaponId ?? last?.build?.weaponId;
}

/** The plan kinds of the built-in weapon builds, in the table's column order. */
const PLAN_KINDS = ["balanced", "earliest", "gildaMax"] as const;
const KIND_OF_VARIANT: Record<string, (typeof PLAN_KINDS)[number]> = {
  balanced: "balanced",
  earliest: "earliest",
  "gilda-max": "gildaMax",
};
const kindOf = (g: Guide) => KIND_OF_VARIANT[planVariant(g.id) ?? ""];

/** Owner and type groups, in the weapon list's order. */
const BUILD_GROUPS = [
  { owner: "max", type: "wrench" },
  { owner: "max", type: "gun" },
  { owner: "max", type: "club" },
  { owner: "monica", type: "sword" },
  { owner: "monica", type: "armband" },
] as const;

/** A build's finish chapter and total ABS ("47k"), worked out once per guide. */
const summaries = new Map<string, { chapter: string; abs: string } | undefined>();
function buildSummary(g: Guide) {
  if (!summaries.has(g.id)) {
    const last = g.steps.findLast((s) => s.build && s.chapterId);
    const abs = deriveBuild(g).total.abs;
    summaries.set(
      g.id,
      last?.chapterId
        ? {
            chapter: last.chapterId,
            abs: abs >= 1000 ? `${Math.round(abs / 1000)}k` : String(Math.round(abs)),
          }
        : undefined,
    );
  }
  return summaries.get(g.id);
}

/** A calm list row: title (opens the guide), a small bar and the dashboard switch at the right. */
function GuideRow({ guide, icon }: { guide: Guide; icon?: React.ReactNode }) {
  const t = useTranslations();
  const checks = useChecks();
  const { activeGuides } = useProfile();
  const p = guideProgress(guide, checks);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {icon}
      <a href={viewHref(guide)} className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold hover:underline">{guide.title}</span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {t("step.progress", { done: p.done, total: p.total })}
          </span>
        </span>
        <span aria-hidden className="bg-muted h-1.5 overflow-hidden rounded-full">
          <span className="bg-primary block h-full" style={{ width: `${pct}%` }} />
        </span>
      </a>
      <Switch
        checked={activeGuides.includes(guide.id)}
        onCheckedChange={(v) => toggleGuide(guide.id, v)}
        aria-label={`${t("guides.active")}: ${guide.title}`}
      />
    </li>
  );
}

const list = "bg-card divide-y-2 overflow-hidden rounded-lg border-2";
const heading = "font-heading text-base font-extrabold tracking-tight";

export function GuidesPage() {
  const t = useTranslations();
  const { guides, activeGuides } = useProfile();
  const transfer = useContentTransfer();
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();
  const match = (g: Guide) => !needle || g.title.toLowerCase().includes(needle);

  const all = [...builtinGuides, ...guides];
  const onDashboard = all.filter((g) => activeGuides.includes(g.id) && match(g));

  // Built-in weapon builds: one row per starred weapon, grouped by owner and type, with a column
  // per plan kind (always in the same order).
  const builds = useMemo(() => {
    const byTarget = new Map<string, Guide[]>();
    for (const g of weaponGuides) {
      const target = targetOf(g) ?? g.id;
      byTarget.set(target, [...(byTarget.get(target) ?? []), g]);
    }
    return BUILD_GROUPS.map((grp) => ({
      ...grp,
      rows: [...byTarget]
        .filter(([target]) => getWeapon(target).type === grp.type)
        .sort(([a], [b]) => getWeapon(a).name.localeCompare(getWeapon(b).name)),
    })).filter((grp) => grp.rows.length);
  }, []);
  const shownBuilds = builds
    .map((grp) => ({
      ...grp,
      rows: grp.rows.filter(
        ([target, variants]) =>
          !needle || getWeapon(target).name.toLowerCase().includes(needle) || variants.some(match),
      ),
    }))
    .filter((grp) => grp.rows.length);

  return (
    <Gate on={["url", "state"]} className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title={t("guides.title")}
        description={t("guides.intro")}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" />}
                aria-label={t("dash.moreActions")}
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled={!transfer.canExport} onClick={transfer.exportAll}>
                  {t("transfer.exportAll")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={transfer.openImport}>
                  {t("transfer.import")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              nativeButton={false}
              render={<a href={withBase("/tools/planner/editor?new")} />}
            >
              <PlusIcon />
              {t("guides.new")}
            </Button>
          </>
        }
      />
      {transfer.input}
      {transfer.message}

      <div className="bg-background/95 sticky top-0 z-20 -mx-4 px-4 py-2 backdrop-blur">
        <label className="bg-card focus-within:ring-ring flex h-10 items-center gap-2 rounded-md border-2 px-3 focus-within:ring-2">
          <SearchIcon className="text-muted-foreground size-4" aria-hidden />
          <input
            type="search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder={t("guides.search")}
            aria-label={t("guides.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <section aria-labelledby="guides-on" className="flex flex-col gap-2">
        <h2 id="guides-on" className={heading}>
          {t("guides.onDashboard")}
        </h2>
        {onDashboard.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("guides.noneOn")}</p>
        ) : (
          <ul className={list}>
            {onDashboard.map((g) => (
              <GuideRow key={g.id} guide={g} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="guides-mine" className="flex flex-col gap-2">
        <h2 id="guides-mine" className={heading}>
          {t("guides.custom")}
        </h2>
        {guides.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-dashed p-4">
            <p className="text-muted-foreground text-sm">{t("guides.customEmpty")}</p>
            <Button nativeButton={false} render={<a href={withBase("/tools/planner")} />}>
              {t("guides.openPlanner")}
            </Button>
          </div>
        ) : (
          <ul className={list}>
            {guides.filter(match).map((g) => (
              <GuideRow key={g.id} guide={g} />
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs">{t("transfer.hint")}</p>
      </section>

      <section aria-labelledby="guides-builds" className="flex flex-col gap-2">
        <h2 id="guides-builds" className={heading}>
          {t("guides.weaponBuilds")}
        </h2>
        <div className={cn(list, "divide-y-0")} role="table" aria-label={t("guides.weaponBuilds")}>
          <div
            role="row"
            className="bg-muted/60 text-muted-foreground hidden items-center gap-1.5 border-b-2 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(3,6.5rem)]"
          >
            <span role="columnheader">{t("guides.buildsWeapon")}</span>
            {PLAN_KINDS.map((k) => (
              <span key={k} role="columnheader" className="text-center">
                {t(`guides.kind.${k}` as const)}
              </span>
            ))}
          </div>
          {shownBuilds.map((grp) => (
            <div key={grp.type} role="rowgroup">
              <div
                role="row"
                className="bg-muted/30 text-muted-foreground border-b px-3 py-1 text-[11px] font-semibold [&:not(:first-child)]:border-t-2"
              >
                <span role="rowheader">
                  {t(`weapons.${grp.owner}` as const)} · {t(`weapon.type.${grp.type}` as const)}
                </span>
              </div>
              {grp.rows.map(([target, variants]) => {
                const weapon = getWeapon(target);
                const Icon = TYPE_ICON[weapon.type];
                return (
                  <div
                    key={target}
                    role="row"
                    // On phones the plans sit on a second line under the name, in the same three columns.
                    className="border-border/20 grid grid-cols-3 items-center gap-x-1.5 gap-y-1.5 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_repeat(3,6.5rem)]"
                  >
                    <span
                      role="rowheader"
                      className="col-span-3 flex min-w-0 items-center gap-2 sm:col-span-1"
                    >
                      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <span className="truncate text-sm font-semibold">{weapon.name}</span>
                    </span>
                    {PLAN_KINDS.map((k) => {
                      const g = variants.find((v) => kindOf(v) === k);
                      if (!g)
                        return (
                          <span
                            key={k}
                            role="cell"
                            className="text-muted-foreground/60 text-center"
                          >
                            –
                          </span>
                        );
                      const on = activeGuides.includes(g.id);
                      const sum = buildSummary(g);
                      return (
                        <span key={k} role="cell" className="flex flex-col items-center gap-0.5">
                          <a
                            href={viewHref(g)}
                            aria-label={`${g.title}${on ? ` (${t("guides.isOn")})` : ""}`}
                            className={cn(
                              "w-full truncate rounded-full border-2 px-1.5 py-0.5 text-center text-xs font-semibold whitespace-nowrap",
                              on
                                ? "bg-accent text-accent-foreground shadow-sticker-sm"
                                : "border-border/40 text-muted-foreground hover:border-border",
                            )}
                          >
                            {on ? "✓ " : ""}
                            {t(`guides.kind.${k}` as const)}
                          </a>
                          {sum && (
                            <span className="text-muted-foreground text-[10px] whitespace-nowrap tabular-nums">
                              {t("guides.buildSummary", { ch: sum.chapter, abs: sum.abs })}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {match(mainWalkthrough) && !activeGuides.includes(mainWalkthrough.id) && (
        <section aria-labelledby="guides-walkthrough" className="flex flex-col gap-2">
          <h2 id="guides-walkthrough" className={heading}>
            {t("guides.builtin")}
          </h2>
          <ul className={list}>
            <GuideRow
              guide={mainWalkthrough}
              icon={<BookOpenIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />}
            />
          </ul>
        </section>
      )}
    </Gate>
  );
}
