import { TriangleAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import { withBase } from "@/lib/base";
import { dismissStorageProblem, readBackup } from "@/lib/store";
import { useStorageProblem } from "@/lib/useAppStore";

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Explains a problem with the data stored in this browser, and how to keep it safe. */
export function StorageBanner() {
  const t = useTranslations();
  const problem = useStorageProblem();
  if (!problem) return null;

  const backup = problem.kind === "corrupt" ? problem.backupKey : null;
  return (
    <div
      role="alert"
      className="border-destructive bg-destructive/10 mb-4 flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 text-sm"
    >
      <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p>{t(`storage.${problem.kind}` as const)}</p>
        <div className="flex flex-wrap gap-2">
          {problem.kind === "newer" && (
            <Button size="sm" onClick={() => location.reload()}>
              {t("storage.reload")}
            </Button>
          )}
          {backup && (
            <Button
              size="sm"
              onClick={() => {
                const text = readBackup(backup);
                if (text) downloadText("dcc-unreadable-backup.json", text);
              }}
            >
              {t("storage.downloadBackup")}
            </Button>
          )}
          {problem.kind === "save-failed" && (
            <Button size="sm" nativeButton={false} render={<a href={withBase("/settings")} />}>
              {t("storage.export")}
            </Button>
          )}
        </div>
      </div>
      {problem.kind !== "newer" && (
        <button
          type="button"
          aria-label={t("storage.dismiss")}
          onClick={dismissStorageProblem}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
