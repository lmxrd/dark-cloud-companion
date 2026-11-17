import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";

type Status = { done: number; total: number; bytes?: number };

/**
 * The database pages kept for offline use: how many are saved, and a button that saves the rest.
 * The service worker does the work (see integrations/sw-template.js) and reports back by message.
 */
export function OfflinePages() {
  const t = useTranslations();
  const [status, setStatus] = useState<Status>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw?.controller) {
      setAvailable(false);
      return;
    }
    const onMessage = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === "PAGES_STATUS")
        setStatus((s) => ({ ...s, done: m.done, total: m.total, bytes: m.bytes }));
      if (m?.type === "PAGES_PROGRESS") setStatus((s) => ({ ...s, done: m.done, total: m.total }));
      if (m?.type === "PAGES_DONE") {
        setStatus((s) => ({ ...s, done: m.done, total: m.total }));
        setSaving(false);
        setFailed(m.failed > 0);
      }
    };
    sw.addEventListener("message", onMessage);
    sw.controller.postMessage({ type: "PAGES_STATUS" });
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  const save = () => {
    setSaving(true);
    setFailed(false);
    navigator.serviceWorker.controller?.postMessage({ type: "SAVE_PAGES" });
  };
  const mb = status?.bytes ? Math.max(1, Math.round(status.bytes / 1_000_000)) : "?";
  const complete = !!status && status.total > 0 && status.done >= status.total;

  return (
    <div className="bg-card flex flex-col gap-2 rounded-lg border-2 p-3 text-sm">
      <p className="text-muted-foreground">{t("db.offline.intro", { mb })}</p>
      {!available ? (
        <p className="text-muted-foreground text-xs">{t("db.offline.unavailable")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={save} disabled={saving || complete}>
            {complete ? t("db.offline.done") : t("db.offline.save")}
          </Button>
          {status && (
            <span role="status" className="text-muted-foreground tabular-nums">
              {saving
                ? t("db.offline.saving", { done: status.done, total: status.total })
                : t("db.offline.status", { done: status.done, total: status.total })}
            </span>
          )}
        </div>
      )}
      {failed && <p className="text-destructive text-xs">{t("db.offline.failed")}</p>}
    </div>
  );
}
