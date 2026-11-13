import { cn } from "cn";
import { CircleDashedIcon, CrosshairIcon, GemIcon, SwordIcon, WrenchIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WeaponType } from "@/lib/schemas";
import { useTranslations } from "@/i18n";

/** One tab per weapon type, in the order the planner shows them. */
const TYPE_TABS: { type: WeaponType; Icon: LucideIcon }[] = [
  { type: "wrench", Icon: WrenchIcon },
  { type: "sword", Icon: SwordIcon },
  { type: "gun", Icon: CrosshairIcon },
  { type: "armband", Icon: GemIcon },
  { type: "club", Icon: CircleDashedIcon },
];

/** Weapon-type chooser for the generator: a scrollable row of labelled chips. */
export function WeaponTypeTabs({
  value,
  onChange,
}: {
  value: WeaponType;
  onChange: (type: WeaponType) => void;
}) {
  const t = useTranslations();
  return (
    <div
      role="tablist"
      aria-label={t("planner.weaponType")}
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-0.5 pb-1.5 [scrollbar-width:none]"
    >
      {TYPE_TABS.map(({ type, Icon }) => {
        const active = type === value;
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(type)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
              active
                ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
                : "border-border/40 text-muted-foreground hover:border-border",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {t(`weapon.type.${type}` as const)}
          </button>
        );
      })}
    </div>
  );
}
