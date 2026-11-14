import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import { $updateWaiting, applyUpdate } from "@/lib/sw";
import { useHydrationSafe } from "@/lib/useAppStore";

/** Shown when a new version of the app is installed and waiting; Reload switches every tab to it. */
export function UpdatePrompt() {
  const t = useTranslations();
  const waiting = useHydrationSafe($updateWaiting, null);
  if (!waiting) return null;
  return (
    <div
      role="status"
      className="bg-card shadow-sticker fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border-2 px-3 py-2 md:bottom-4"
    >
      <RefreshCwIcon className="text-secondary size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-sm font-medium">{t("update.available")}</span>
      <Button size="sm" onClick={applyUpdate}>
        {t("update.reload")}
      </Button>
    </div>
  );
}
