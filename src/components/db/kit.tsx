// Building blocks shared by the database pages (/db): the lists (a sticky search, segmented tabs,
// filter chips, a sort with its direction, card lists) and the pages of single things (a header card
// with facts, then boxed sections of linked rows). Detail pages render on the server only, so
// nothing here may depend on browser state.
import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { core, names } from "@/lib/gamedata";
import { withBase } from "@/lib/base";
import { useTranslations } from "@/i18n";

/** A display name by id, falling back to the id. */
export const nameOf = (table: keyof typeof names, id: string | null | undefined) =>
  id ? (names[table][id] ?? id) : "";

const sectionChapter = new Map(core.sections.map((s) => [s.id, s.chapterNumber]));
/** The chapter a section (floor, fight or story event) belongs to. */
export const chapterOfSection = (id: string) => sectionChapter.get(id);

/** Lower-case text to match a search against. */
export const matches = (needle: string, ...texts: (string | null | undefined)[]) =>
  !needle || texts.some((s) => s?.toLowerCase().includes(needle));

// ─── links ────────────────────────────────────────────────────────────────────────────────────────

/** A link to another page of the app (root-relative path, the base is added). */
export function Ref({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={withBase(href)}
      className={cn(
        "decoration-primary/70 hover:bg-accent hover:text-accent-foreground underline decoration-2 underline-offset-2",
        className,
      )}
    >
      {children}
    </a>
  );
}

// ─── lists ────────────────────────────────────────────────────────────────────────────────────────

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

const chipClass = (active: boolean) =>
  cn(
    "flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-semibold whitespace-nowrap",
    active
      ? "border-border bg-accent text-accent-foreground shadow-sticker-sm"
      : "border-border/40 text-muted-foreground hover:border-border",
  );

/** A labelled row of filter chips; picking the active one again clears it when `clearable`. */
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
  clearable = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  clearable?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
    >
      <span className="text-muted-foreground shrink-0 text-xs font-semibold">{label}:</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(clearable && value === o.value ? options[0].value : o.value)}
          className={chipClass(value === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ascending or descending. */
export type SortDir = "asc" | "desc";

/** Sort chips plus a button that flips the direction. */
export function SortChips<T extends string>({
  value,
  options,
  onChange,
  dir,
  onDir,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  dir: SortDir;
  onDir: (d: SortDir) => void;
}) {
  const t = useTranslations();
  return (
    <div
      role="group"
      aria-label={t("db.sort")}
      className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
    >
      <span className="text-muted-foreground shrink-0 text-xs font-semibold">{t("db.sort")}:</span>
      <button
        type="button"
        onClick={() => onDir(dir === "asc" ? "desc" : "asc")}
        aria-label={dir === "asc" ? t("db.sortAsc") : t("db.sortDesc")}
        title={dir === "asc" ? t("db.sortAsc") : t("db.sortDesc")}
        className={cn(chipClass(false), "border-border text-foreground px-2")}
      >
        {dir === "asc" ? (
          <ArrowUpIcon className="size-3.5" aria-hidden />
        ) : (
          <ArrowDownIcon className="size-3.5" aria-hidden />
        )}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={chipClass(value === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Applies a direction to an ascending comparison. */
export const directed =
  <T,>(cmp: (a: T, b: T) => number, dir: SortDir) =>
  (a: T, b: T) =>
    dir === "asc" ? cmp(a, b) : cmp(b, a);

/** A titled group of rows. */
export function Section({
  title,
  meta,
  children,
  id,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="flex scroll-mt-28 flex-col gap-2" id={id}>
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

/** One row of a section: an optional source tag, a title line, details, and a right column. */
export function Row({
  title,
  aside,
  tag,
  href,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  /** A short label in front (Shop, Drop, …). */
  tag?: ReactNode;
  /** Makes the title a link. */
  href?: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      {tag && (
        <span className="text-muted-foreground w-14 shrink-0 pt-0.5 text-[10px] font-bold tracking-wider uppercase">
          {tag}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-semibold">
          {href ? <Ref href={href}>{title}</Ref> : title}
        </span>
        {children}
      </div>
      {aside && (
        <div className="flex shrink-0 flex-col items-end text-right text-xs tabular-nums">
          {aside}
        </div>
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
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "dashed" && "text-muted-foreground border-dashed",
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

// ─── pages of single things ───────────────────────────────────────────────────────────────────────

/** The header card: kind chips, the name, a description, key facts and actions. */
export function Hero({
  kinds,
  title,
  description,
  facts,
  children,
  actions,
}: {
  kinds?: ReactNode[];
  title: ReactNode;
  description?: ReactNode;
  facts?: ({ label: ReactNode; value: ReactNode } | false | null | undefined | "" | 0)[];
  /** Chips or other content under the facts. */
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const shown = (facts ?? []).filter((f): f is { label: ReactNode; value: ReactNode } => !!f);
  return (
    <section className="bg-card shadow-sticker flex flex-col gap-4 rounded-xl border-2 p-4">
      {kinds && kinds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider uppercase">
          {kinds.map((k, i) => (
            <span key={i} className="rounded-full border-2 px-2 py-0.5">
              {k}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-balance md:text-3xl">
          {title}
        </h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {shown.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {shown.map((f, i) => (
            <div
              key={i}
              className="bg-background flex min-w-0 flex-col rounded-lg border-2 px-3 py-2"
            >
              <dt className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                {f.label}
              </dt>
              <dd className="font-heading text-xl font-extrabold break-words tabular-nums">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

/**
 * A boxed section of rows on a detail page. Long sections show the first `limit` rows and fold the
 * rest into a "Show all" disclosure (no script needed). Empty sections render nothing.
 */
export function DetailSection({
  title,
  meta,
  rows,
  limit = 8,
}: {
  title: ReactNode;
  meta?: ReactNode;
  rows: ReactNode[];
  limit?: number;
}) {
  const t = useTranslations();
  if (!rows.length) return null;
  const head = rows.length > limit + 2 ? rows.slice(0, limit) : rows;
  const rest = rows.slice(head.length);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading flex items-baseline justify-between gap-2 text-base font-extrabold tracking-tight">
        <span>{title}</span>
        <span className="text-muted-foreground text-xs font-normal tabular-nums">
          {meta ?? (rows.length > 1 ? rows.length : null)}
        </span>
      </h2>
      <div className="bg-card overflow-hidden rounded-lg border-2">
        <ul className="flex flex-col divide-y-2">{head}</ul>
        {rest.length > 0 && (
          <details className="group border-t-2">
            <summary className="bg-muted/60 text-muted-foreground cursor-pointer list-none px-3 py-2 text-xs font-semibold group-open:hidden">
              {t("db.showAll", { n: rows.length })}
            </summary>
            <ul className="flex flex-col divide-y-2">{rest}</ul>
          </details>
        )}
      </div>
    </section>
  );
}

/** A section that holds free content (chips, a chart) instead of rows. */
export function DetailBlock({
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
        {meta && <span className="text-muted-foreground text-xs font-normal">{meta}</span>}
      </h2>
      {children}
    </section>
  );
}

/** The column of a detail page. */
export const DetailPage = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-6">{children}</div>
);
