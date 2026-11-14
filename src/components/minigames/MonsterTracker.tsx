import { useChecks } from "@/lib/useAppStore";
import { cn } from "cn";
import { useTranslations } from "@/i18n";
import { monsterCheckIds, monsterClasses } from "@/lib/reference";
import type { MonsterClass } from "@/lib/schemas";
import { setChecked } from "@/lib/store";
import { TrackerLayout, type TrackerGroup } from "./TrackerLayout";

type Form = MonsterClass["forms"][number];

/** One evolution form and what it evolves into, as a branching tree. */
function FormNode({ form, byName }: { form: Form; byName: Map<string, Form> }) {
  const t = useTranslations();
  const next = form.evolvesTo.map((n) => byName.get(n)).filter((f): f is Form => !!f);
  return (
    <li className="relative pl-4 before:absolute before:top-0 before:left-0 before:h-4 before:w-3 before:rounded-bl-md before:border-b-2 before:border-l-2">
      <span className="bg-background inline-flex flex-col rounded-md border-2 px-2 py-0.5">
        <span className="text-sm font-semibold">
          {form.name}
          {form.note && (
            <span className="text-muted-foreground text-xs font-normal"> · {form.note}</span>
          )}
        </span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {t("monsters.stats", { atk: form.atk, def: form.def })}
        </span>
      </span>
      {next.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {next.map((f) => (
            <FormNode key={f.name} form={f} byName={byName} />
          ))}
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

  const groups: TrackerGroup[] = monsterClasses.map((c) => {
    const [badge, mastered] = monsterCheckIds(c.id);
    const byName = new Map(c.forms.map((f) => [f.name, f]));
    return {
      id: c.id,
      label: c.name,
      title: c.name,
      subtitle: t("monsters.badgeHow", { how: c.badge }),
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
            {c.forms
              .filter((f) => f.depth === 0)
              .map((f) => (
                <FormNode key={f.name} form={f} byName={byName} />
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
        {
          label: t("monsters.badges"),
          ...count(monsterClasses.map((c) => monsterCheckIds(c.id)[0])),
        },
        {
          label: t("monsters.masteredTotal"),
          ...count(monsterClasses.map((c) => monsterCheckIds(c.id)[1])),
        },
      ]}
      groups={groups}
    />
  );
}
