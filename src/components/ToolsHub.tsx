import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "@/i18n";
import { withBase } from "@/lib/base";

/** Large tiles for the Tools pages. */
export function ToolsHub() {
  const t = useTranslations();
  const tiles = [
    { href: "/tools/planner", title: t("nav.planner"), meta: t("tools.planner") },
    { href: "/tools/shopping", title: t("nav.shopping"), meta: t("tools.shopping") },
    { href: "/tools/spheres", title: t("nav.spheres"), meta: t("tools.spheres") },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {tiles.map((tile) => (
        <li key={tile.href}>
          <a
            href={withBase(tile.href)}
            className="bg-card shadow-sticker flex h-full items-center gap-3 rounded-lg border-2 p-4 transition-[translate,box-shadow] active:translate-x-(--shadow-offset) active:translate-y-(--shadow-offset) active:shadow-none"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-heading text-lg font-extrabold tracking-tight">
                {tile.title}
              </span>
              <span className="text-muted-foreground text-sm">{tile.meta}</span>
            </span>
            <ChevronRightIcon className="text-muted-foreground size-5 shrink-0" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
