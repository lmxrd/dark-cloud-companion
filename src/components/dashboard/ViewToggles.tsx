import { useProfile } from "@/lib/useAppStore";
import { cn } from "cn";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n";
import { setView } from "@/lib/store";

/** The view settings shared by the dashboard's filter sheet and Settings. */
export function useViewToggles() {
  const t = useTranslations();
  const { view } = useProfile();
  const toggles = [
    { key: "showFacts", label: t("view.facts"), hint: undefined },
    { key: "buyableOnly", label: t("view.buyableOnly"), hint: t("view.buyableOnlyHint") },
    { key: "hideDone", label: t("view.hideDone"), hint: undefined },
    { key: "hidePostgame", label: t("view.hidePostgame"), hint: undefined },
  ] as const;
  return { toggles, view, activeCount: toggles.filter((x) => view[x.key]).length };
}

/** One switch row per view setting. */
export function ViewToggles({ className }: { className?: string }) {
  const { toggles, view } = useViewToggles();
  return (
    <div className={cn("flex flex-col", className)}>
      {toggles.map((x) => (
        <label
          key={x.key}
          className="flex min-h-12 cursor-pointer items-center justify-between gap-4 border-b py-2 last:border-b-0"
        >
          <span className="flex flex-col">
            <span className="text-sm font-medium">{x.label}</span>
            {x.hint && <span className="text-muted-foreground text-xs">{x.hint}</span>}
          </span>
          <Switch checked={view[x.key]} onCheckedChange={(v) => setView({ [x.key]: v })} />
        </label>
      ))}
    </div>
  );
}
