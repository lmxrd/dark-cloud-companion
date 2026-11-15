import type { ReactNode } from "react";
import { useTranslations } from "@/i18n";
import type { MonsterClass, MonsterForm } from "@/lib/gamedata/types";
import { byId, enemiesOfClass, evolvesFrom, monsters, names } from "@/lib/db/data";
import { dbHref, monsterFormHref } from "@/lib/db/routes";
import { cn } from "cn";
import {
  Chip,
  Chips,
  DetailBlock,
  DetailPage,
  DetailSection,
  Detail,
  Hero,
  Ref,
  Row,
} from "../kit";
import { FormRef } from "../text";

/** Forms of a class in evolution order: roots first, then what each evolves into. */
export function formsInOrder(classId: string): MonsterForm[] {
  const forms = monsters.forms.filter((f) => f.classId === classId);
  const into = new Set(forms.flatMap((f) => f.evolvesInto.map((e) => e.toId)));
  const out: MonsterForm[] = [];
  const visit = (f: MonsterForm) => {
    if (out.includes(f)) return;
    out.push(f);
    for (const e of f.evolvesInto) {
      const next = byId.monsterForm.get(e.toId);
      if (next) visit(next);
    }
  };
  forms.filter((f) => !into.has(f.id)).forEach(visit);
  forms.forEach(visit);
  return out;
}

/** The evolution levels and items of one step. */
function evolveNote(t: ReturnType<typeof useTranslations>, e: MonsterForm["evolvesInto"][number]) {
  return (
    <>
      {t("monsters.evolveFrom", { level: e.level })}
      {e.requiredItemId && (
        <>
          {", "}
          {e.requiredQuantity ?? 1}×{" "}
          <Ref href={dbHref("item", e.requiredItemId)}>{names.items[e.requiredItemId]}</Ref>
        </>
      )}
    </>
  );
}

const unlockText = (
  t: ReturnType<typeof useTranslations>,
  u: (typeof monsters.unlocks)[number],
) => (
  <>
    {t(`db.unlock.${u.method}` as const, {
      n: u.quantity ?? 1,
      enemy: u.enemyId ? names.enemies[u.enemyId] : "",
    })}{" "}
    <Ref href={dbHref("item", u.itemId)}>{names.items[u.itemId]}</Ref>
  </>
);

/** A monster class: the badge, how to unlock it, level rewards, its forms and its enemies. */
export function MonsterClassPage({ cls, actions }: { cls: MonsterClass; actions?: ReactNode }) {
  const t = useTranslations();
  const forms = formsInOrder(cls.id);
  const enemies = enemiesOfClass.get(cls.id) ?? [];
  return (
    <DetailPage>
      <Hero
        kinds={[
          t("db.kind.monsterClass"),
          t("reference.chapterShort", { n: cls.chapterNumber ?? "?" }),
        ]}
        title={cls.name}
        facts={[
          cls.badgeName && {
            label: t("monsters.badge"),
            value: <span className="text-base">{cls.badgeName}</span>,
          },
          { label: t("monsters.forms"), value: forms.length },
          { label: t("nav.bestiary"), value: enemies.length },
        ]}
        actions={actions}
      />
      <DetailSection
        title={t("db.unlockClass")}
        rows={monsters.unlocks
          .filter((u) => u.classId === cls.id)
          .map((u) => (
            <Row
              key={u.id}
              title={unlockText(t, u)}
              aside={<Chip tone="dashed">{t(`db.unlockMethod.${u.method}` as const)}</Chip>}
            >
              {u.enemyId && (
                <Detail>
                  <Ref href={dbHref("enemy", u.enemyId)}>{names.enemies[u.enemyId]}</Ref>
                </Detail>
              )}
            </Row>
          ))}
      />
      <DetailSection
        title={t("db.levelRewards")}
        rows={monsters.levelRewards
          .filter((r) => r.classId === cls.id)
          .sort((a, b) => a.level - b.level)
          .map((r) => (
            <Row
              key={`${r.level}-${r.itemId}`}
              title={<Ref href={dbHref("item", r.itemId)}>{names.items[r.itemId]}</Ref>}
              aside={t("db.levelN", { n: r.level })}
            />
          ))}
      />
      <DetailSection
        title={t("monsters.forms")}
        rows={forms.map((f) => (
          <Row
            key={f.id}
            title={<FormRef classId={cls.id} id={f.id} name={f.name} />}
            aside={t("monsters.stats", { atk: f.attack, def: f.defense })}
          >
            {f.evolvesInto.length > 0 && (
              <Detail>
                →{" "}
                {f.evolvesInto.map((e, i) => (
                  <span key={e.toId}>
                    {i > 0 && ", "}
                    {byId.monsterForm.get(e.toId)?.name} ({t("db.levelN", { n: e.level })})
                  </span>
                ))}
              </Detail>
            )}
          </Row>
        ))}
        limit={12}
      />
      {enemies.length > 0 && (
        <DetailBlock title={t("db.enemiesOfClass")} meta={enemies.length}>
          <Chips>
            {enemies.map((e) => (
              <Chip key={e.id}>
                <Ref href={dbHref("enemy", e.id)}>{e.name}</Ref>
              </Chip>
            ))}
          </Chips>
        </DetailBlock>
      )}
    </DetailPage>
  );
}

/** A monster form: stats and where it sits in its class's evolution tree. */
export function MonsterFormPage({ form: f }: { form: MonsterForm }) {
  const t = useTranslations();
  const from = evolvesFrom.get(f.id) ?? [];
  const others = formsInOrder(f.classId).filter((x) => x.id !== f.id);
  const dot = (kind: "me" | "next" | "prev") => (
    <span
      aria-hidden
      className={cn(
        "absolute top-1 -left-7 size-5 rounded-full border-2",
        kind === "me" ? "bg-accent" : "bg-background",
        kind === "next" && "border-dashed",
      )}
    />
  );
  return (
    <DetailPage>
      <Hero
        kinds={[
          <Ref href={dbHref("monsterClass", f.classId)}>{names.monsterClasses[f.classId]}</Ref>,
          t("db.kind.monsterForm"),
        ]}
        title={f.name}
        facts={[
          { label: t("stat.at"), value: f.attack },
          { label: t("db.defense"), value: f.defense },
        ]}
      />
      <DetailBlock title={t("db.evolution")}>
        <ol className="bg-card relative flex flex-col gap-2.5 rounded-lg border-2 p-3 pl-10">
          <span aria-hidden className="bg-border absolute top-5 bottom-5 left-[21px] w-0.5" />
          {from.map((p) => {
            const e = p.evolvesInto.find((x) => x.toId === f.id)!;
            return (
              <li key={p.id} className="relative flex flex-col text-sm">
                {dot("prev")}
                <FormRef classId={p.classId} id={p.id} name={p.name} />
                <Detail>{evolveNote(t, e)}</Detail>
              </li>
            );
          })}
          <li className="relative text-sm">
            {dot("me")}
            <span className="font-heading font-extrabold" aria-current="page">
              {f.name}
            </span>
          </li>
          {f.evolvesInto.map((e) => {
            const next = byId.monsterForm.get(e.toId)!;
            return (
              <li key={e.toId} className="relative flex flex-col text-sm">
                {dot("next")}
                <FormRef classId={next.classId} id={next.id} name={next.name} />
                <Detail>{evolveNote(t, e)}</Detail>
              </li>
            );
          })}
        </ol>
        {from.length === 0 && f.evolvesInto.length === 0 && <Detail>{t("db.noEvolution")}</Detail>}
      </DetailBlock>
      <DetailSection
        title={t("db.otherForms")}
        rows={others.map((x) => (
          <Row
            key={x.id}
            title={<Ref href={monsterFormHref(x.classId, x.id)}>{x.name}</Ref>}
            aside={t("monsters.stats", { atk: x.attack, def: x.defense })}
          />
        ))}
        limit={6}
      />
    </DetailPage>
  );
}
