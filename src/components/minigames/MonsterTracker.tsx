import { useChecks } from "@/lib/useAppStore";
import { cn } from "cn";
import { useTranslations } from "@/i18n";
import { collectables, names, type MonsterForm } from "@/lib/gamedata";
import { monsters } from "@/lib/gamedata/monsters";
import { tick } from "@/lib/gamedata/ticks";
import { setChecked } from "@/lib/store";
import { TrackerLayout, type TrackerGroup } from "./TrackerLayout";

const formById = new Map(monsters.forms.map((f) => [f.id, f]));
const evolvedInto = new Set(monsters.forms.flatMap((f) => f.evolvesInto.map((e) => e.toId)));

/** One evolution form and what it evolves into, as a branching tree. */
function FormNode({ form, note }: { form: MonsterForm; note?: string }) {
  const t = useTranslations();
  return (
    <li className="relative pl-4 before:absolute before:top-0 before:left-0 before:h-4 before:w-3 before:rounded-bl-md before:border-b-2 before:border-l-2">
      <span className="bg-background inline-flex flex-col rounded-md border-2 px-2 py-0.5">
        <span className="text-sm font-semibold">
          {form.name}
          {note && <span className="text-muted-foreground text-xs font-normal"> · {note}</span>}
        </span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {t("monsters.stats", { atk: form.attack, def: form.defense })}
        </span>
      </span>
      {form.evolvesInto.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {form.evolvesInto.map((e) => {
            const next = formById.get(e.toId);
            if (!next) return null;
            const parts = [t("monsters.evolveFrom", { level: e.level })];
            if (e.requiredItemId)
              parts.push(
                t("monsters.needs", {
                  n: e.requiredQuantity ?? 1,
                  item: names.items[e.requiredItemId],
                }),
              );
            return <FormNode key={e.toId} form={next} note={parts.join(", ")} />;
          })}
        </ul>
      )}
    </li>
  );
}

/** A big toggle tile backed by a native checkbox stretched over it. */
function ToggleTile({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "relative grid min-h-11 place-items-center rounded-md border-2 px-2 text-sm font-semibold has-focus-visible:ring-2 has-focus-visible:ring-ring",
        checked ? "bg-accent text-accent-foreground shadow-sticker-sm" : "text-muted-foreground",
      )}
    >
      <input
        type="checkbox"
        className="absolute inset-0 cursor-pointer appearance-none rounded-[inherit] outline-none"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {checked ? "✓ " : ""}
        {label}
      </span>
    </label>
  );
}

export function MonsterTracker() {
  const t = useTranslations();
  const checks = useChecks();
  const count = (ids: string[]) => ({
    done: ids.filter((id) => checks[id]).length,
    total: ids.length,
  });
  const classes = collectables.monsterClasses;

  const groups: TrackerGroup[] = classes.map((c) => {
    const badge = tick.badge(c.id);
    const mastered = tick.mastered(c.id);
    const how = monsters.unlocks
      .filter((u) => u.classId === c.id)
      .map((u) => {
        const item = names.items[u.itemId];
        const enemy = u.enemyId ? names.enemies[u.enemyId] : "";
        return u.method === "buy"
          ? t("monsters.unlock.buy", { item })
          : u.method === "gift"
            ? t("monsters.unlock.gift", { n: u.quantity ?? 1, item, enemy })
            : t("monsters.unlock.kill-with", { item, enemy });
      })
      .join(" / ");
    const roots = monsters.forms.filter((f) => f.classId === c.id && !evolvedInto.has(f.id));
    return {
      id: c.id,
      label: c.name,
      title: c.name,
      subtitle: t("monsters.badgeHow", { how }),
      count: count([badge, mastered]),
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-3 p-2">
          <div className="grid grid-cols-2 gap-2">
            <ToggleTile
              label={t("monsters.badge")}
              checked={!!checks[badge]}
              onChange={(v) => setChecked(badge, v)}
            />
            <ToggleTile
              label={t("monsters.mastered")}
              checked={!!checks[mastered]}
              onChange={(v) => setChecked(mastered, v)}
            />
          </div>
          <ul aria-label={t("monsters.forms")} className="flex flex-col gap-1">
            {roots.map((f) => (
              <FormNode key={f.id} form={f} />
            ))}
          </ul>
        </div>
      ),
    };
  });

  return (
    <TrackerLayout
      intro={t("monsters.intro")}
      totals={[
        { label: t("monsters.badges"), ...count(classes.map((c) => tick.badge(c.id))) },
        { label: t("monsters.masteredTotal"), ...count(classes.map((c) => tick.mastered(c.id))) },
      ]}
      groups={groups}
    />
  );
}
