import { BuildStepBody, acquireText } from "@/components/guide/BuildStepBody";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n";
import { deriveBuild } from "@/lib/guide/derive";
import type { Guide } from "@/lib/guide/types";
import { getWeapon } from "@/lib/planner/sources";

/** Read-only preview of a generated guide's build steps (nothing is saved). */
export function PlanPreview({ guide }: { guide: Guide }) {
  const t = useTranslations();
  const derived = deriveBuild(guide);
  const route = [...new Set(guide.steps.flatMap((s) => (s.build ? [s.build.weaponId] : [])))];
  const last = guide.steps.filter((s) => s.build).at(-1)?.build?.weaponId;
  if (last && !route.includes(last)) route.push(last);
  const acquire = guide.build?.acquire;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-2">
        {[
          { label: t("planner.bigAbs"), value: Math.round(derived.total.abs).toLocaleString() },
          { label: t("planner.bigGilda"), value: Math.round(derived.total.gilda).toLocaleString() },
          { label: t("planner.bigSteps"), value: derived.total.steps.toLocaleString() },
        ].map((x) => (
          <div key={x.label} className="bg-card flex flex-col rounded-lg border-2 px-3 py-2">
            <dt className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              {x.label}
            </dt>
            <dd className="font-heading truncate text-xl font-extrabold tabular-nums sm:text-2xl">
              {x.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm">
        <span className="text-muted-foreground">{t("planner.route")}: </span>
        {route.map((id) => getWeapon(id).name).join(" → ")}
      </p>
      {/* The optimal start may be a weapon the player does not own yet: say how to get it. */}
      {guide.build && acquire && acquire.kind !== "have" && (
        <p className="text-muted-foreground text-xs">
          {t("planner.step.acquire", { weapon: getWeapon(guide.build.weaponId).name })}:{" "}
          {acquireText(t, acquire)}
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {guide.steps.map((s, i) => (
          <li key={s.id}>
            <Card size="sm">
              <CardHeader>
                <CardTitle>
                  {i + 1}. {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BuildStepBody step={s} derived={derived.steps.get(s.id)} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
