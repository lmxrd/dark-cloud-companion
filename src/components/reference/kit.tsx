// Small building blocks shared by the data reference pages (fishing, bestiary, shops, people), in
// the same style as the items list: a sticky search, segmented tabs, and card lists.
import type { ReactNode } from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "cn";
import { core, names } from "@/lib/gamedata";

/** A display name by id, falling back to the id. */
export const nameOf = (table: keyof typeof names, id: string | null | undefined) =>
  id ? (names[table][id] ?? id) : "";

const sectionChapter = new Map(core.sections.map((s) => [s.id, s.chapterNumber]));
/** The chapter a section (floor, fight or story event) belongs to. */
export const chapterOfSection = (id: string) => sectionChapter.get(id);

/** Lower-case text to match a search against. */
export const matches = (needle: string, ...texts: (string | null | undefined)[]) =>
  !needle || texts.some((s) => s?.toLowerCase().includes(needle));

/** A search box and optional controls that stay at the top while the list scrolls. */
export function StickyBar({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="bg-background/95 sticky top-0 z-20 -mx-4 flex flex-col gap-2 px-4 py-2 backdrop-blur">
      <label className="bg-card focus-within:ring-ring flex h-10 items-center gap-2 rounded-md border-2 px-3 focus-within:ring-2">
        <SearchIcon className="text-muted-foreground size-4" aria-hidden />
        <input
          type="search"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder={label}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {children}
    </div>
  );
}

/** Segmented buttons for the page's tabs or a filter. */
export function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted/60 flex w-full overflow-x-auto rounded-lg border-2 p-0.5 [scrollbar-width:none] sm:w-fit"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap sm:flex-none",
            value === o.value
              ? "bg-card shadow-sticker-sm"
              : "text-muted-foreground border-transparent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A titled group of rows. */
export function Section({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading flex items-baseline justify-between gap-2 text-base font-extrabold tracking-tight">
        <span>{title}</span>
        {meta && (
          <span className="text-muted-foreground text-xs font-normal tabular-nums">{meta}</span>
        )}
      </h2>
      <ul className="bg-card flex flex-col divide-y-2 overflow-hidden rounded-lg border-2">
        {children}
      </ul>
    </section>
  );
}

/** One row of a section: a title line, then whatever details. */
export function Row({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-semibold">{title}</span>
        {children}
      </div>
      {aside && (
        <div className="flex shrink-0 flex-col items-end text-xs tabular-nums">{aside}</div>
      )}
    </li>
  );
}

/** A small rounded label. */
export function Chip({
  children,
  tone = "plain",
  title,
}: {
  children: ReactNode;
  tone?: "plain" | "accent" | "dashed" | "good" | "bad";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "rounded-full border-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tone === "accent" && "bg-accent",
        tone === "dashed" && "border-dashed",
        tone === "good" && "bg-secondary/25",
        tone === "bad" && "bg-destructive/15",
      )}
    >
      {children}
    </span>
  );
}

/** A wrapping line of chips. */
export const Chips = ({ children }: { children: ReactNode }) => (
  <span className="flex flex-wrap gap-1">{children}</span>
);

/** A muted detail line. */
export const Detail = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground text-xs">{children}</span>
);

/** Shown when a search leaves nothing. */
export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground text-sm">{children}</p>
);
