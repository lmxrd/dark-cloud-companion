import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import { setThemePref } from "@/lib/theme";

export const repoUrl = "https://github.com/lmxrd/dark-cloud-companion";

/** GitHub's mark (lucide has no brand icons). */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.82 1.1.82 2.22l-.01 3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}

/** Whether the page is dark, following changes made elsewhere (Settings, another toggle). */
function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setDark(html.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/** Icon buttons for the source code and the light/dark switch (sidebar footer and phone header). */
export function AppLinks({ className }: { className?: string }) {
  const t = useTranslations();
  const dark = useIsDark();
  const themeLabel = dark ? t("theme.light") : t("theme.dark");
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <a
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={t("nav.github")}
        title={t("nav.github")}
        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
      >
        <GitHubIcon className="size-4" />
      </a>
      <Button
        variant="outline"
        size="icon"
        aria-label={themeLabel}
        title={themeLabel}
        onClick={() => setThemePref(dark ? "light" : "dark")}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </Button>
    </div>
  );
}
