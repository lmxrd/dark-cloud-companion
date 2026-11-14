import { useChecks } from "@/lib/useAppStore";
import { cn } from "cn";
import { withBase } from "@/lib/base";
import { CheckRow } from "@/components/chapter/CheckRow";
import { weaponData } from "@/lib/planner/sources";
import { useTranslations } from "@/i18n";
import { chapters, sectionById } from "@/lib/data";
import { clubCheckId, sphedaMedals } from "@/lib/reference";
import { setChecked } from "@/lib/store";
import { TrackerLayout, type TrackerGroup } from "./TrackerLayout";

export function SphedaTracker() {
  const t = useTranslations();
  const checks = useChecks();
  const clubs = weaponData.weapons
    .filter((w) => w.type === "club")
    .sort((a, b) => a.name.localeCompare(b.name));
  const owned = clubs.filter((c) => checks[clubCheckId(c.id)]).length;
  const done = sphedaMedals.filter((m) => checks[m.id]).length;

  const groups: TrackerGroup[] = chapters
    .filter((c) => c.phase === "main")
    .flatMap((c) => {
      const medals = sphedaMedals.filter((m) => sectionById.get(m.sectionId)?.chapterId === c.id);
      if (!medals.length) return [];
      const title = `${c.number}. ${c.title}`;
      return [
        {
          id: c.id,
          label: t("guides.chapterShort", { n: c.number }),
          title,
          count: {
            done: medals.filter((m) => checks[m.id]).length,
            total: medals.length,
          },
          children: (
            <>
              {medals.map((m) => (
                <CheckRow
                  key={m.id}
                  dense
                  checked={!!checks[m.id]}
                  onChange={(v) => setChecked(m.id, v)}
                  label={<span className="font-semibold">{m.value}</span>}
                  detail={sectionById.get(m.sectionId)?.title}
                />
              ))}
              <a
                className="text-muted-foreground block px-2 py-1.5 text-xs underline"
                href={withBase(`/?chapter=${c.id}`)}
              >
                {t("spheda.openChapter")}
              </a>
            </>
          ),
        },
      ];
    });
  // Open the first chapter that still has prizes to win.
  const firstOpen = groups.find((g) => g.count.done < g.count.total);
  if (firstOpen) firstOpen.defaultOpen = true;

  return (
    <TrackerLayout
      intro={t("spheda.intro")}
      totals={[
        { label: t("spheda.medals"), done, total: sphedaMedals.length },
        { label: t("spheda.clubsOwned"), done: owned, total: clubs.length },
      ]}
      before={
        <section aria-labelledby="spheda-clubs" className="flex flex-col gap-2">
          <h2 id="spheda-clubs" className="font-heading text-base font-extrabold tracking-tight">
            {t("spheda.clubs")}
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {clubs.map((c) => {
              const have = !!checks[clubCheckId(c.id)];
              return (
                <li key={c.id} className="flex items-stretch">
                  <label
                    className={cn(
                      "relative flex items-center rounded-l-full border-2 px-3 py-1 text-xs font-semibold has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      have
                        ? "bg-accent text-accent-foreground"
                        : "border-border/50 text-muted-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="absolute inset-0 cursor-pointer appearance-none rounded-[inherit] outline-none"
                      checked={have}
                      onChange={(e) => setChecked(clubCheckId(c.id), e.target.checked)}
                      aria-label={t("spheda.own", { club: c.name })}
                    />
                    {have ? "✓ " : ""}
                    {c.name}
                  </label>
                  <a
                    href={withBase(`/weapons/${c.id}`)}
                    aria-label={t("spheda.openWeapon", { club: c.name })}
                    className={cn(
                      "grid place-items-center rounded-r-full border-2 border-l-0 px-2 text-xs",
                      have ? "border-border" : "border-border/50 text-muted-foreground",
                    )}
                  >
                    ›
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      }
      groups={groups}
    />
  );
}
