import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { useChecks } from "@/lib/useAppStore";
import { setChecked } from "@/lib/store";

/** A tick on a database page (owned, taken, recruited…), shared with the dashboard and trackers. */
export function TickToggle({ tickId, label }: { tickId: string; label: string }) {
  const checks = useChecks();
  const on = !!checks[tickId];
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setChecked(tickId, !on)}
      className={cn(
        "flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-sm font-semibold",
        on ? "bg-accent text-accent-foreground shadow-sticker-sm" : "bg-card text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 place-items-center rounded-sm border-2",
          on ? "bg-secondary border-border" : "border-border/60",
        )}
      >
        {on && <CheckIcon className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
