import { CheckRow } from "@/components/chapter/CheckRow";
import { Badge } from "@/components/ui/badge";
import type { ChecklistItem } from "@/lib/data";
import { useTranslations } from "@/i18n";
import { inventionReady, sectionById } from "@/lib/data";
import { setChecked } from "@/lib/store";
import { AddToListButton } from "@/components/shopping/AddToListButton";

/** A collectable (scoop, idea, invention, power-up, …) with its badges and details. */
export function ItemRow({ item, checks }: { item: ChecklistItem; checks: Record<string, true> }) {
  const t = useTranslations();
  const section = item.sectionId ? sectionById.get(item.sectionId) : undefined;
  const ready = item.category === "invention" && !checks[item.id] && inventionReady(item, checks);
  const detail = [
    item.recipe?.map((r) => (r.scoop ? `${r.name} (scoop)` : r.name)).join(" + "),
    ...(item.notes ?? []),
    section && !item.notes?.includes(section.title) ? section.title : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <CheckRow
      dense
      checked={!!checks[item.id]}
      onChange={(v) => setChecked(item.id, v)}
      label={item.name}
      detail={detail || undefined}
      badges={
        <>
          <Badge variant="outline">{t(`cat.${item.category}` as const)}</Badge>
          {item.missable && <Badge variant="destructive">{t("missable.badge")}</Badge>}
          {item.ghost && <Badge variant="outline">{t("ghost.badge")}</Badge>}
          {item.postgame && <Badge variant="secondary">{t("postgame.badge")}</Badge>}
          {ready && <Badge>{t("ready.badge")}</Badge>}
          {item.category === "invention" && !checks[item.id] && (
            <AddToListButton name={item.name} goal={{ kind: "invention", name: item.name }} />
          )}
          {item.georamaPart && !checks[item.id] && (
            <AddToListButton
              name={`${item.georamaPart.qty}× ${item.georamaPart.name}`}
              goal={{ kind: "georama", name: item.georamaPart.name, qty: item.georamaPart.qty }}
            />
          )}
        </>
      }
    />
  );
}
