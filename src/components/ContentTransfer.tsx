import { useStore } from "@nanostores/react";
import { useRef, useState } from "react";
import { buildContentExport } from "@/lib/content-file";
import { useTranslations } from "@/i18n";
import type { Guide } from "@/lib/guide/types";
import { $profile, applyContent } from "@/lib/store";

export function downloadGuides(filename: string, guides: Guide[]) {
  const blob = new Blob([JSON.stringify(buildContentExport(guides), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const fileSafe = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "export";

/**
 * Export-all and import for the user's own guides (content only, no progress). The caller places the
 * actions (a menu) and renders `input` and `message` somewhere on the page.
 */
export function useContentTransfer() {
  const t = useTranslations();
  const { guides } = useStore($profile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    // The validator pulls in weapon/item data, so load it only when importing.
    const { parseContentImport } = await import("@/lib/content-transfer");
    const parsed = parseContentImport(await file.text());
    if (!parsed.ok) setMessage(t("transfer.failed", { error: parsed.error }));
    else setMessage(t("transfer.done", { ...applyContent(parsed.file) }));
    if (fileRef.current) fileRef.current.value = "";
  };

  return {
    canExport: guides.length > 0,
    exportAll: () => downloadGuides("dcc-guides.json", guides),
    openImport: () => fileRef.current?.click(),
    input: (
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => onImport(e.target.files?.[0])}
      />
    ),
    message: message && (
      <p className="text-sm whitespace-pre-line" role="status">
        {message}
      </p>
    ),
  };
}
