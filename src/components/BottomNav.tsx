import { cn } from "cn";
import { useTranslations } from "@/i18n";
import { withBase } from "@/lib/base";
import { isSectionActive, mainNav } from "@/components/nav";

/** Phone-only tab bar with the four main sections; clears the home indicator of installed PWAs. */
export function BottomNav({ pathname }: { pathname: string }) {
  const t = useTranslations();
  return (
    <nav
      aria-label={t("nav.tabs")}
      data-slot="bottom-nav"
      className="bg-background fixed inset-x-0 bottom-0 z-40 border-t-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5 gap-1 px-2 py-1.5">
        {mainNav(t).map((item) => {
          const active = isSectionActive(item, pathname);
          return (
            <li key={item.href}>
              <a
                href={withBase(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-transparent text-[11px] font-semibold",
                  active
                    ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
