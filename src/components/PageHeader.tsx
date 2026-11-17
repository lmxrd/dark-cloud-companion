import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * The one page title block: a heavy Geist heading, an optional one-line description and actions on
 * the right. Renders statically from Astro pages too (no hydration needed).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-balance md:text-3xl">
          {title}
        </h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
