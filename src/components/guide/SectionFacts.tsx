import { useEffect, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n";
import { collectables, names } from "@/lib/gamedata";
import { useChapterDetail } from "@/lib/gamedata/useChapterDetail";
import type { medalItems, Section } from "@/lib/data";
import { setChecked } from "@/lib/store";

/**
 * A section's medals and prizes as a strip of tiles (yellow once won), plus its facts (enemies, totals, boss, …) as one summary
 * line that expands on tap. `showFacts` decides whether it starts expanded. The facts come from the
 * chapter's floor detail, which loads on demand.
 */
export function SectionFacts({
  section,
  medals,
  checks,
  showFacts,
  showKind = true,
}: {
  section: Section;
  medals: ReturnType<typeof medalItems>;
  checks: Record<string, true>;
  showFacts: boolean;
  /** False when the enclosing step header already shows the section kind. */
  showKind?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(showFacts);
  useEffect(() => setOpen(showFacts), [showFacts]);
  const detail = useChapterDetail(Number(section.chapterId))?.[section.id];
  const recruits = collectables.recruits.filter((r) => r.sectionId === section.id);
  const enemies = detail?.enemies ?? [];
  const bosses = enemies.filter((e) => e.type === "boss" || e.type === "sub-boss");
  const totals = detail && detail.totals.abs + detail.totals.gilda > 0 ? detail.totals : undefined;
  const hasFacts = section.kind === "dungeon" || section.kind === "boss" || recruits.length > 0;
  const enemyText = (list: typeof enemies) =>
    list.map((e) => `${names.enemies[e.enemyId]}${e.carriesKey ? "*" : ""} ×${e.count}`).join(", ");
  const summary = detail
    ? [
        totals && t("section.totals", { abs: totals.abs, gilda: totals.gilda }),
        enemies.length > 0 && t("section.enemyCount", { n: enemies.length }),
        bosses.length > 0 &&
          t("section.boss", { name: bosses.map((b) => names.enemies[b.enemyId]).join(", ") }),
      ]
        .filter(Boolean)
        .join(" · ")
    : t("section.loading");
  const hasBadges = showKind || section.restriction;
  return (
    <div className="flex flex-col">
      {hasBadges && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-1 text-xs">
          {showKind && (
            <Badge variant="outline">{t(`section.kind.${section.kind}` as const)}</Badge>
          )}
          {section.restriction && (
            <Badge variant="secondary">
              {t(
                `seal.${section.restriction}` as `seal.${"white-seal" | "blue-seal" | "red-seal"}`,
              )}
            </Badge>
          )}
        </div>
      )}
      {medals.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 px-2 py-1">
          {medals.map((m) => {
            const won = !!checks[m.id];
            const kind = t(`medal.short.${m.kind}` as const);
            const value =
              m.kind === "clear-goal"
                ? t(
                    `clearGoal.${m.value}` as `clearGoal.${NonNullable<NonNullable<Section["medals"]>["clearGoal"]>}`,
                  )
                : m.value;
            return (
              <button
                key={m.id}
                type="button"
                role="checkbox"
                aria-checked={won}
                aria-label={`${kind}: ${value}`}
                onClick={() => setChecked(m.id, !won)}
                className={cn(
                  "flex min-h-12 min-w-0 flex-col items-start justify-center rounded-md border-2 px-2 py-1 text-left transition-[translate,box-shadow]",
                  won
                    ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
                    : "border-border/40 hover:border-border",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-wider uppercase",
                    won ? "" : "text-muted-foreground",
                  )}
                >
                  {won ? "✓ " : ""}
                  {kind}
                </span>
                <span className="w-full truncate text-xs font-semibold" title={value}>
                  {value}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {hasFacts && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-label={t("section.moreFacts")}
            onClick={() => setOpen((o) => !o)}
            className="text-muted-foreground hover:bg-muted/50 flex min-h-7 items-center justify-between gap-2 rounded-md px-2 text-left text-xs"
          >
            <span className="min-w-0 truncate">{open ? t("section.moreFacts") : summary}</span>
            <ChevronDownIcon className={`size-3.5 shrink-0 ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="text-muted-foreground flex flex-col gap-0.5 px-2 pb-1 text-xs">
              {!detail && <p>{t("section.loading")}</p>}
              {bosses.length > 0 && (
                <p>
                  {t("section.boss", {
                    name: bosses.map((b) => names.enemies[b.enemyId]).join(", "),
                  })}
                </p>
              )}
              {(totals || section.hasGeostone) && (
                <p>
                  {totals ? t("section.totals", { abs: totals.abs, gilda: totals.gilda }) : ""}
                  {section.hasGeostone
                    ? `${totals ? " · " : ""}${t("section.geostone")}${
                        detail?.geostoneParts.length
                          ? `: ${detail.geostoneParts.map((p) => names.georamaParts[p]).join(", ")}`
                          : ""
                      }`
                    : ""}
                </p>
              )}
              {enemies.some((e) => !e.starArea) && (
                <p>
                  {t("section.enemies")}: {enemyText(enemies.filter((e) => !e.starArea))}
                </p>
              )}
              {enemies.some((e) => e.starArea) && (
                <p>
                  {t("section.starArea")}: {enemyText(enemies.filter((e) => e.starArea))}
                </p>
              )}
              {detail && detail.georamaItems.length > 0 && (
                <p>
                  {t("section.materials", {
                    items: detail.georamaItems.map((i) => names.items[i]).join(", "),
                  })}
                </p>
              )}
              {recruits.length > 0 && (
                <p>
                  {t("section.recruits", {
                    names: recruits.map((r) => names.npcs[r.npcId]).join(", "),
                  })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
