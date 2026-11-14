import { useEffect, useState, type ReactNode } from "react";
import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslations } from "@/i18n";
import { useReady } from "@/lib/useAppStore";
import { Gate } from "@/components/Gate";

export type Count = { done: number; total: number };

export interface TrackerGroup {
  id: string;
  title: ReactNode;
  /** Plain name for the jump chip. */
  label: string;
  subtitle?: ReactNode;
  count: Count;
  /** Open on first visit (finished groups still start closed). */
  defaultOpen?: boolean;
  children: ReactNode;
}

const pct = (c: Count) => (c.total ? Math.round((c.done / c.total) * 100) : 0);
const finished = (c: Count) => c.total > 0 && c.done === c.total;

/**
 * The shared tracker page: a hero with the totals, sticky chips that jump to a group, and the groups
 * as accordions with counts. Finished groups start collapsed.
 */
export function TrackerLayout({
  intro,
  totals,
  before,
  groups,
}: {
  intro?: ReactNode;
  totals: ({ label: string } & Count)[];
  /** Extra content between the hero and the groups (e.g. a selector). */
  before?: ReactNode;
  groups: TrackerGroup[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, !!g.defaultOpen])),
  );
  const scrollTo = (id: string, behavior: ScrollBehavior) =>
    requestAnimationFrame(() =>
      document.getElementById(`group-${id}`)?.scrollIntoView({ behavior, block: "start" }),
    );
  // Saved ticks arrive right after hydration: then fold finished groups and open the defaults
  // computed from them, plus the group named by the hash (#c3). Once only; afterwards the user decides.
  const ready = useReady();
  useEffect(() => {
    if (!ready) return;
    const linked = decodeURIComponent(location.hash.slice(1));
    const target = groups.some((g) => g.id === linked) ? linked : undefined;
    setOpen((o) =>
      Object.fromEntries(
        groups.map((g) => [
          g.id,
          g.id === target || (finished(g.count) ? false : o[g.id] || !!g.defaultOpen),
        ]),
      ),
    );
    if (target) scrollTo(target, "instant");
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // A jump chip opens its group and names it in the hash, so a reload returns there.
  const jump = (id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    history.replaceState(history.state, "", `#${encodeURIComponent(id)}`);
    scrollTo(id, "smooth");
  };

  return (
    <Gate on={["url", "state"]} className="flex flex-col gap-4">
      {intro && <p className="text-muted-foreground text-sm">{intro}</p>}

      <section
        aria-label={t("tracker.progress")}
        className="bg-card shadow-sticker grid gap-4 rounded-xl border-2 p-4 grid-cols-2"
      >
        {totals.map((x) => (
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
              aria-valuenow={pct(x)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bg-primary h-full" style={{ width: `${pct(x)}%` }} />
            </div>
          </div>
        ))}
      </section>

      {before}

      <nav
        aria-label={t("tracker.jump")}
        className="bg-background/95 sticky top-0 z-20 -mx-4 px-4 py-2 backdrop-blur"
      >
        <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {groups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => jump(g.id)}
                className={cn(
                  "shrink-0 rounded-full border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap tabular-nums",
                  finished(g.count)
                    ? "bg-accent text-accent-foreground"
                    : "border-border/40 text-muted-foreground hover:border-border",
                )}
              >
                {g.label} {g.count.done}/{g.count.total}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {groups.map((g) => (
        <Collapsible
          key={g.id}
          id={`group-${g.id}`}
          open={open[g.id] ?? false}
          onOpenChange={(v) => setOpen((o) => ({ ...o, [g.id]: v }))}
          className="bg-card scroll-mt-16 overflow-hidden rounded-lg border-2"
        >
          <CollapsibleTrigger className="flex w-full flex-col gap-1.5 px-3 py-2.5 text-left">
            <span className="flex w-full items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{g.title}</span>
                {g.subtitle && (
                  <span className="text-muted-foreground block text-xs">{g.subtitle}</span>
                )}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {g.count.done} / {g.count.total}
              </span>
              <ChevronDownIcon
                className={cn("size-4 shrink-0 transition-transform", open[g.id] && "rotate-180")}
                aria-hidden
              />
            </span>
            <span aria-hidden className="bg-muted h-1 w-full overflow-hidden rounded-full">
              <span className="bg-primary block h-full" style={{ width: `${pct(g.count)}%` }} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t-2 px-1 py-1">{g.children}</CollapsibleContent>
        </Collapsible>
      ))}
    </Gate>
  );
}
