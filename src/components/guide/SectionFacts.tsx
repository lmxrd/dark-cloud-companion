import { useEffect, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n";
import type { medalItems } from "@/lib/data";
import type { Section } from "@/lib/schemas";
import { setChecked } from "@/lib/store";

/**
 * A section's medals and prizes as a strip of tiles (yellow once won), plus its facts (enemies, totals, boss, …) as one summary
 * line that expands on tap. `showFacts` decides whether it starts expanded.
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
  const hasFacts =
    !!section.boss ||
    !!section.totals ||
    section.enemies.length > 0 ||
    section.georamaBuild.length > 0 ||
    section.recruits.length > 0;
  const summary = [
    section.totals && t("section.totals", { abs: section.totals.abs, gilda: section.totals.gilda }),
    section.enemies.length > 0 && t("section.enemyCount", { n: section.enemies.length }),
    section.boss && t("section.boss", { name: section.boss.name }),
  ]
    .filter(Boolean)
    .join(" · ");
  const hasBadges = showKind || section.seal || section.special;
  return (
    <div className="flex flex-col">
      {hasBadges && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-1 text-xs">
          {showKind && (
            <Badge variant="outline">{t(`section.kind.${section.kind}` as const)}</Badge>
          )}
          {section.seal && (
            <Badge variant="secondary">{t("section.seal", { seal: section.seal })}</Badge>
          )}
          {section.special && (
            <Badge variant="outline">{t("section.special", { text: section.special })}</Badge>
          )}
        </div>
      )}
      {medals.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 px-2 py-1">
          {medals.map((m) => {
            const won = !!checks[m.id];
            const kind =
              m.kind === "prize" && m.prizeType === "spheda"
                ? t("medal.short.spheda")
                : t(`medal.short.${m.kind}` as const);
            return (
              <button
                key={m.id}
                type="button"
                role="checkbox"
                aria-checked={won}
                aria-label={`${kind}: ${m.value}`}
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
                <span className="w-full truncate text-xs font-semibold" title={m.value}>
                  {m.value}
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
              {section.boss && (
                <p>
                  {t("section.boss", { name: section.boss.name })}
                  {section.boss.scoop ? ` (${t("section.bossScoop")})` : ""}
                </p>
              )}
              {section.totals && (
                <p>
                  {t("section.totals", { abs: section.totals.abs, gilda: section.totals.gilda })}
                  {section.geostone ? ` · ${t("section.geostone")}: ${section.geostone}` : ""}
                </p>
              )}
              {section.enemies.length > 0 && (
                <p>
                  {t("section.enemies")}:{" "}
                  {section.enemies
                    .map((e) => `${e.name}${e.carriesKey ? "*" : ""} ×${e.count}`)
                    .join(", ")}
                </p>
              )}
              {section.georamaBuild.length > 0 && (
                <p>
                  {t("section.georama", {
                    parts: section.georamaBuild.map((g) => `${g.qty}× ${g.name}`).join(", "),
                  })}
                </p>
              )}
              {section.recruits.map((r) => (
                <p key={r.name}>{t("section.recruits", { name: r.name, where: r.location })}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
