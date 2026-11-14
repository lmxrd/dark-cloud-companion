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
import { builtinGuides, weaponGuides } from "@/lib/guide/builtin";
import { mainWalkthrough } from "@/lib/guide/main";
import { guideProgress } from "@/lib/guide/progress";
import type { Guide } from "@/lib/guide/types";
import { getWeapon } from "@/lib/planner/sources";
import { toggleGuide } from "@/lib/store";

const viewHref = (g: Guide) => withBase(`/guides/view?id=${encodeURIComponent(g.id)}`);

/** The weapon a build guide ends in: its last build step's weapon or build-up target. */
function targetOf(g: Guide): string | undefined {
  const last = g.steps.findLast((s) => s.build || s.buildUp);
  return last?.buildUp?.weaponId ?? last?.build?.weaponId;
}

/** The variant part of a built-in title ("Grade Zero — Least ABS" → "Least ABS"). */
const variantOf = (g: Guide) => g.title.split(" — ").at(-1) ?? g.title;

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

  // Built-in weapon builds, one row per target weapon with its variants.
  const builds = useMemo(() => {
    const byTarget = new Map<string, Guide[]>();
    for (const g of weaponGuides) {
      const target = targetOf(g) ?? g.id;
      byTarget.set(target, [...(byTarget.get(target) ?? []), g]);
    }
    return [...byTarget];
  }, []);
  const shownBuilds = builds.filter(
    ([target, variants]) =>
      !needle || getWeapon(target).name.toLowerCase().includes(needle) || variants.some(match),
  );

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
            <Button nativeButton={false} render={<a href={withBase("/planner/editor?new")} />}>
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
            <Button nativeButton={false} render={<a href={withBase("/planner")} />}>
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
        <ul className={list}>
          {shownBuilds.map(([target, variants]) => {
            const weapon = getWeapon(target);
            const Icon = TYPE_ICON[weapon.type];
            return (
              <li key={target} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{weapon.name}</span>
                <span className="flex gap-1.5">
                  {variants.map((g) => {
                    const on = activeGuides.includes(g.id);
                    return (
                      <a
                        key={g.id}
                        href={viewHref(g)}
                        aria-label={`${g.title}${on ? ` (${t("guides.isOn")})` : ""}`}
                        className={cn(
                          "rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                          on
                            ? "bg-accent text-accent-foreground shadow-sticker-sm"
                            : "border-border/40 text-muted-foreground hover:border-border",
                        )}
                      >
                        {on ? "✓ " : ""}
                        {variantOf(g)}
                      </a>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ul>
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
