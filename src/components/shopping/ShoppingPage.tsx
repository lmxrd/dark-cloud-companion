import { useEffect, useMemo, useRef, useState } from "react";
import { MinusIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useTranslations, type Translate } from "@/i18n";
import { weaponGuides } from "@/lib/guide/builtin";
import type { Guide } from "@/lib/guide/types";
import type { ShoppingGoal } from "@/lib/profiles";
import {
  georamaPartByName,
  georamaParts,
  goalSteps,
  findInvention,
  inventions,
  itemInfo,
  itemNames,
  type GoalInput,
  type ShoppingLine,
} from "@/lib/shopping";
import { addShoppingGoal, completeShoppingGoal, updateShopping } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useShopping } from "./useShopping";

type Kind = ShoppingGoal["kind"];
type Filter = "all" | Kind;

const KIND_CLASS: Record<Kind, string> = {
  item: "bg-card text-foreground",
  invention: "bg-accent text-accent-foreground",
  georama: "bg-secondary text-secondary-foreground",
  build: "bg-primary text-primary-foreground",
};

function KindBadge({ kind }: { kind: Kind }) {
  const t = useTranslations();
  return (
    <Badge variant="outline" className={cn("uppercase", KIND_CLASS[kind])}>
      {t(`shopping.kind.${kind}` as const)}
    </Badge>
  );
}

const gilda = (n: number) => n.toLocaleString("en-US");
const recipeText = (r: { name: string; qty: number }[], times = 1) =>
  r.map((c) => `${c.qty * times} ${c.name}`).join(" · ");

function Stepper({
  value,
  onChange,
  min = 0,
  label,
  showLabel = false,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  label: string;
  showLabel?: boolean;
}) {
  const t = useTranslations();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (n: number) => onChange(Math.max(min, Number.isFinite(n) ? Math.floor(n) : min));
  return (
    <span className="border-border bg-card inline-flex h-7 items-center overflow-hidden rounded-md border-2">
      {showLabel && (
        <span className="text-muted-foreground pr-1 pl-2 text-xs font-semibold">{label}</span>
      )}
      <button
        type="button"
        className="bg-muted hover:bg-muted/70 grid h-full w-6 place-items-center"
        aria-label={`${t("shopping.less")}: ${label}`}
        onClick={() => commit(value - 1)}
      >
        <MinusIcon className="size-3" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        aria-label={label}
        className="w-10 bg-transparent text-center font-mono text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value !== "") commit(Number(e.target.value));
        }}
        onBlur={() => setText(String(value))}
      />
      <button
        type="button"
        className="bg-muted hover:bg-muted/70 grid h-full w-6 place-items-center"
        aria-label={`${t("shopping.more")}: ${label}`}
        onClick={() => commit(value + 1)}
      >
        <PlusIcon className="size-3" />
      </button>
    </span>
  );
}

// ---------- add panel ----------

interface CatalogEntry {
  kind: Kind;
  key: string;
  name: string;
  meta: string;
  goal: GoalInput;
}

function buildCatalog(t: Translate, own: Guide[]): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const name of itemNames) {
    const info = itemInfo(name);
    const meta =
      info.kind === "buyable"
        ? `${t("shopping.gilda", { n: gilda(info.price) })} · ${info.shops.join(", ")}`
        : t("shopping.notSold");
    out.push({ kind: "item", key: `i:${name}`, name, meta, goal: { kind: "item", name } });
  }
  for (const i of inventions)
    out.push({
      kind: "invention",
      key: `v:${i.name}`,
      name: i.name,
      meta: recipeText(i.components),
      goal: { kind: "invention", name: i.name },
    });
  for (const p of georamaParts)
    out.push({
      kind: "georama",
      key: `p:${p.name}`,
      name: p.name,
      meta: [p.cost ? t("shopping.gilda", { n: gilda(p.cost) }) : "", recipeText(p.components)]
        .filter(Boolean)
        .join(" · "),
      goal: { kind: "georama", name: p.name },
    });
  for (const g of [...weaponGuides, ...own]) {
    const steps = g.steps.filter((s) => s.build?.synths.some((x) => x.kind === "item"));
    if (!steps.length) continue;
    out.push({
      kind: "build",
      key: `b:${g.id}`,
      name: g.title,
      meta: t("shopping.allSteps", { n: steps.length }),
      goal: { kind: "build", guideId: g.id, stepIds: steps.map((s) => s.id) },
    });
    for (const s of steps) {
      const items = s.build!.synths.flatMap((x) =>
        x.kind === "item" ? [{ name: x.name, qty: x.count }] : [],
      );
      out.push({
        kind: "build",
        key: `b:${g.id}:${s.id}`,
        name: s.title || g.title,
        meta: `${t("shopping.step", { guide: g.title, n: g.steps.indexOf(s) + 1 })} · ${recipeText(items)}`,
        goal: { kind: "build", guideId: g.id, stepIds: [s.id] },
      });
    }
  }
  return out;
}

function AddPanel({
  own,
  searchRef,
}: {
  own: Guide[];
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const catalog = useMemo(() => buildCatalog(t, own), [t, own]);
  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle && filter === "all") return [];
    return catalog
      .filter(
        (c) =>
          (filter === "all" || c.kind === filter) &&
          (!needle ||
            c.name.toLowerCase().includes(needle) ||
            c.meta.toLowerCase().includes(needle)),
      )
      .sort((a, b) => {
        // Name matches before matches in the details.
        const an = needle && a.name.toLowerCase().includes(needle) ? 0 : 1;
        const bn = needle && b.name.toLowerCase().includes(needle) ? 0 : 1;
        return an - bn;
      })
      .slice(0, 40);
  }, [catalog, needle, filter]);
  const filters: Filter[] = ["all", "item", "invention", "georama", "build"];
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("shopping.add")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="relative block">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            ref={searchRef}
            type="search"
            className="pl-8"
            placeholder={t("shopping.search")}
            aria-label={t("shopping.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("shopping.add")}>
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className="border-border bg-card aria-pressed:bg-sidebar-accent aria-pressed:shadow-sticker-sm rounded-full border-2 px-2.5 text-xs leading-5 font-semibold"
            >
              {t(`shopping.filter.${f}` as const)}
            </button>
          ))}
        </div>
        <ul
          className="-mx-1 flex max-h-80 flex-col gap-0.5 overflow-y-auto px-1"
          aria-label={t("shopping.add")}
        >
          {!needle && filter === "all" ? (
            <li className="text-muted-foreground px-2 py-1 text-sm">
              {t("shopping.typeToSearch")}
            </li>
          ) : results.length === 0 ? (
            <li className="text-muted-foreground px-2 py-1 text-sm">
              {t("shopping.noResults", { q })}
            </li>
          ) : (
            results.map((c) => (
              <li
                key={c.key}
                className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <KindBadge kind={c.kind} />
                    {c.name}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">{c.meta}</div>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-label={`${t("shopping.addShort")} ${c.name}`}
                  onClick={() => addShoppingGoal(c.goal)}
                >
                  <PlusIcon data-icon="inline-start" />
                  {t("shopping.addShort")}
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- goals ----------

function goalLabel(goal: ShoppingGoal, findGuide: (id: string) => Guide | undefined) {
  if (goal.kind !== "build") return goal.qty > 1 ? `${goal.name} ×${goal.qty}` : goal.name;
  return findGuide(goal.guideId)?.title ?? goal.guideId;
}

function GoalCard({
  goal,
  missing,
  findGuide,
  onMade,
}: {
  goal: ShoppingGoal;
  missing: boolean;
  findGuide: (id: string) => Guide | undefined;
  onMade: (goal: ShoppingGoal) => void;
}) {
  const t = useTranslations();
  const remove = () =>
    updateShopping((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== goal.id) }));
  const setQty = (qty: number) =>
    updateShopping((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === goal.id && g.kind !== "build" ? { ...g, qty } : g)),
    }));
  let title: string;
  let sub = "";
  let recipe = "";
  if (goal.kind === "build") {
    const { guide, steps } = goalSteps(goal, findGuide);
    title = guide?.title ?? goal.guideId;
    sub = steps.length === 1 ? steps[0].title : t("shopping.stepsCount", { n: steps.length });
    const items = new Map<string, number>();
    for (const s of steps)
      for (const x of s.build!.synths)
        if (x.kind === "item") items.set(x.name, (items.get(x.name) ?? 0) + x.count);
    recipe = recipeText([...items].map(([name, qty]) => ({ name, qty })));
  } else {
    title = goal.name;
    if (goal.kind === "invention") {
      const inv = findInvention(goal.name);
      if (inv) {
        recipe = recipeText(inv.components, goal.qty);
        sub = t("shopping.inventionChapter", { n: inv.chapter });
      }
    } else if (goal.kind === "georama") {
      const p = georamaPartByName.get(goal.name);
      if (p) {
        recipe = recipeText(p.components, goal.qty);
        if (p.geostone) sub = t("shopping.unlockedBy", { geostone: p.geostone });
      }
    }
  }
  return (
    <li className="border-border bg-card flex flex-col gap-1.5 rounded-lg border-2 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <KindBadge kind={goal.kind} />
        <span className="min-w-0 flex-1 truncate font-semibold" title={title}>
          {title}
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={t("shopping.remove", { name: title })}
          onClick={remove}
        >
          <XIcon />
        </Button>
      </div>
      {missing ? (
        <p className="text-destructive text-xs">{t("shopping.missing")}</p>
      ) : (
        <>
          {recipe && goal.kind !== "item" && (
            <p className="text-muted-foreground text-xs">{recipe}</p>
          )}
          {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {goal.kind === "build" ? (
              <span />
            ) : (
              <Stepper
                value={goal.qty}
                min={1}
                onChange={setQty}
                label={goal.kind === "item" ? t("shopping.qty") : t("shopping.make")}
                showLabel
              />
            )}
            {goal.kind !== "item" && (
              <Button type="button" size="xs" variant="outline" onClick={() => onMade(goal)}>
                ✓ {t("shopping.made")}
              </Button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

// ---------- list ----------

function LineRow({
  line,
  shop,
  group,
  goalName,
}: {
  line: ShoppingLine;
  shop?: string;
  group: "stops" | "az";
  goalName: (id: string) => string;
}) {
  const t = useTranslations();
  const done = line.buy === 0;
  const setHave = (n: number) =>
    updateShopping((s) => {
      const have = { ...s.have };
      if (n > 0) have[line.name] = n;
      else delete have[line.name];
      return { ...s, have };
    });
  const shops = line.info.kind === "buyable" ? line.info.shops : [];
  // Under a shop: the other shops that sell it. Elsewhere (A–Z, later chapters): every shop.
  const others = shop ? shops.filter((s) => s !== shop) : shops;
  const forText = line.sources
    .map((s) =>
      s.via ? t("shopping.via", { goal: goalName(s.goalId), via: s.via }) : goalName(s.goalId),
    )
    .join(", ");
  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-dashed py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
        done && "opacity-70",
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={(v) => setHave(v === true ? line.need : 0)}
        aria-label={t("shopping.haveAll", { name: line.name })}
      />
      <div className="min-w-0">
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 text-sm font-medium",
            done && "text-muted-foreground line-through",
          )}
        >
          {line.name}
          {line.later && line.info.kind === "buyable" && (
            <Badge variant="outline" className="border-dashed font-medium">
              {t("shopping.fromChapter", { n: line.info.fromChapter })}
            </Badge>
          )}
          {line.info.kind === "found" && (
            <Badge variant="outline" className="bg-muted border-dashed font-medium">
              {t("shopping.notSold")}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {t("shopping.for")} <span className="text-foreground">{forText}</span>
        </p>
        {others.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {shop ? t("shopping.alsoAt", { shops: others.join(", ") }) : others.join(", ")}
          </p>
        )}
        {line.inventable && (
          <button
            type="button"
            className="decoration-secondary text-xs font-semibold underline decoration-2 underline-offset-2"
            onClick={() =>
              updateShopping((s) => ({ ...s, invent: [...new Set([...s.invent, line.name])] }))
            }
          >
            {t("shopping.inventInstead")}
          </button>
        )}
      </div>
      <div className="col-start-2 row-start-2 sm:col-start-auto sm:row-start-auto">
        <Stepper
          value={line.have}
          onChange={setHave}
          label={`${t("shopping.have")}: ${line.name}`}
        />
      </div>
      <div className="col-start-3 row-span-2 row-start-1 grid justify-items-end sm:col-start-auto sm:row-span-1 sm:row-start-auto">
        <span className="font-mono text-base font-semibold tabular-nums">
          {done ? "✓" : `×${line.buy}`}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {done
            ? `${line.need}/${line.need}`
            : line.info.kind === "buyable"
              ? t("shopping.gilda", { n: gilda(line.info.price * line.buy) })
              : t("shopping.findIt")}
        </span>
      </div>
    </li>
  );
}

function Group({
  title,
  sub,
  stop,
  children,
}: {
  title: string;
  sub: string;
  stop?: number | "done";
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <div className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b-2 px-0.5 pt-3 pb-1.5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold">
          {stop !== undefined && (
            <span
              className={cn(
                "border-border grid size-5 place-items-center rounded-full border-2 font-mono text-[11px]",
                stop === "done" ? "bg-muted" : "bg-secondary text-secondary-foreground",
              )}
            >
              {stop === "done" ? "✓" : stop}
            </span>
          )}
          {title}
        </h3>
        <span className="text-muted-foreground font-mono text-xs">{sub}</span>
      </div>
      <ul>{children}</ul>
    </section>
  );
}

export function ShoppingPage() {
  const t = useTranslations();
  const { profile, shopping, list, chapter, findGuide } = useShopping();
  const [tab, setTab] = useState<"buy" | "goals">("buy");
  const [undo, setUndo] = useState<{ msg: string; run: () => void } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(id);
  }, [undo]);

  const goalById = useMemo(() => new Map(shopping.goals.map((g) => [g.id, g])), [shopping.goals]);
  const goalName = (id: string) => {
    const g = goalById.get(id);
    return g ? goalLabel(g, findGuide) : id;
  };
  const missing = new Set(list.missing);

  const onMade = async (goal: ShoppingGoal) => {
    const run = await completeShoppingGoal(goal.id);
    const name = goalLabel(goal, findGuide);
    setUndo({
      msg:
        goal.kind === "invention"
          ? t("shopping.madeTicked", { name })
          : t("shopping.madeToast", { name }),
      run,
    });
  };

  const rows = (lines: ShoppingLine[], shop?: string) =>
    lines.map((l) => (
      <LineRow key={l.name} line={l} shop={shop} group={shopping.group} goalName={goalName} />
    ));

  let body: React.ReactNode;
  if (!list.lines.length)
    body = <p className="text-muted-foreground py-2 text-sm">{t("shopping.empty")}</p>;
  else if (shopping.group === "az") body = <ul>{rows(list.lines)}</ul>;
  else {
    let n = 0;
    body = (
      <>
        {list.stops.map((s) => (
          <Group
            key={s.shop}
            title={s.shop}
            stop={s.open ? ++n : "done"}
            sub={s.gilda ? t("shopping.gilda", { n: gilda(s.gilda) }) : t("shopping.allBought")}
          >
            {rows(s.lines, s.shop)}
          </Group>
        ))}
        {list.later.length > 0 && (
          <Group title={t("shopping.notSoldYet")} sub={t("shopping.laterChapters")}>
            {rows(list.later)}
          </Group>
        )}
        {list.found.length > 0 && (
          <Group title={t("shopping.findGroup")} sub={t("shopping.findGroupHint")}>
            {rows(list.found)}
          </Group>
        )}
      </>
    );
  }

  const tabButton = (id: "buy" | "goals", label: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className="aria-selected:bg-foreground aria-selected:text-background flex flex-1 items-center justify-center gap-2 px-3 py-1 text-sm font-semibold"
    >
      {label}
      <span className="border-border bg-muted text-foreground rounded-full border px-1.5 font-mono text-xs">
        {count}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("shopping.intro")}{" "}
          <Badge variant="outline">{t("shopping.chapter", { n: chapter })}</Badge>
        </p>
        <Button
          type="button"
          size="sm"
          className="lg:hidden"
          onClick={() => {
            setTab("goals");
            setTimeout(() => searchRef.current?.focus(), 0);
          }}
        >
          <PlusIcon data-icon="inline-start" />
          {t("shopping.addShort")}
        </Button>
      </div>
      <div
        role="tablist"
        className="border-border bg-card flex overflow-hidden rounded-lg border-2 lg:hidden"
      >
        {tabButton("buy", t("shopping.toBuy"), list.left)}
        {tabButton("goals", t("shopping.making"), shopping.goals.length)}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={cn("flex min-w-0 flex-col gap-4", tab !== "goals" && "max-lg:hidden")}>
          <AddPanel own={profile.guides} searchRef={searchRef} />
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {t("shopping.making")}{" "}
                  <span className="text-muted-foreground font-mono text-xs">
                    ({shopping.goals.length})
                  </span>
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  {t("shopping.makingHint")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shopping.goals.length ? (
                <ul className="flex flex-col gap-2" aria-label={t("shopping.making")}>
                  {shopping.goals.map((g) => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      missing={missing.has(g.id)}
                      findGuide={findGuide}
                      onMade={onMade}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">{t("shopping.noGoals")}</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className={cn("min-w-0", tab !== "buy" && "max-lg:hidden")}>
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t("shopping.toBuy")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="border-border bg-accent text-accent-foreground grid grid-cols-3 overflow-hidden rounded-lg border-2">
                {[
                  [t("shopping.toSpend"), t("shopping.gilda", { n: gilda(list.total) })],
                  [t("shopping.linesLeft"), String(list.left)],
                  [t("shopping.stops"), String(list.stops.filter((s) => s.open).length)],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className={cn("flex flex-col px-3 py-2", i > 0 && "border-border border-l-2")}
                  >
                    <dt className="text-[11px] font-bold tracking-wide uppercase opacity-75">
                      {k}
                    </dt>
                    <dd
                      className="font-mono text-base font-semibold tabular-nums sm:text-xl"
                      data-testid={`shopping-${i}`}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className="border-border bg-card inline-flex overflow-hidden rounded-lg border-2"
                  role="group"
                  aria-label={t("shopping.groupBy")}
                >
                  {(["stops", "az"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={shopping.group === g}
                      onClick={() => updateShopping((s) => ({ ...s, group: g }))}
                      className="aria-pressed:bg-foreground aria-pressed:text-background px-3 py-1 text-sm font-semibold"
                    >
                      {t(`shopping.group.${g}` as const)}
                    </button>
                  ))}
                </div>
                {shopping.invent.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {t("shopping.inventing")}{" "}
                    {shopping.invent.map((n, i) => (
                      <span key={n}>
                        {i > 0 && ", "}
                        {n}{" "}
                        <button
                          type="button"
                          className="decoration-secondary font-semibold underline decoration-2 underline-offset-2"
                          onClick={() =>
                            updateShopping((s) => ({
                              ...s,
                              invent: s.invent.filter((x) => x !== n),
                            }))
                          }
                        >
                          {t("shopping.buyInstead")}
                        </button>
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div>{body}</div>
            </CardContent>
          </Card>
        </div>
      </div>
      {undo && (
        <div
          role="status"
          className="bg-foreground text-background fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium shadow-lg"
        >
          <span className="truncate">{undo.msg}</span>
          <button
            type="button"
            className="font-bold underline underline-offset-2"
            onClick={() => {
              undo.run();
              setUndo(null);
            }}
          >
            {t("shopping.undo")}
          </button>
        </div>
      )}
    </div>
  );
}
