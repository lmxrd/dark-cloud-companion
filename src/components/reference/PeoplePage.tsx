import { useTranslations } from "@/i18n";
import { useQueryChoice, useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { collectables } from "@/lib/gamedata";
import { misc } from "@/lib/gamedata/misc";
import type { Recruit } from "@/lib/gamedata/types";
import {
  Chip,
  Chips,
  Detail,
  Empty,
  matches,
  nameOf,
  Row,
  Section,
  Segments,
  StickyBar,
} from "./kit";

const TABS = ["people", "trophies"] as const;
type Tab = (typeof TABS)[number];

/** The people of the game (support skills, how to recruit them) and the trophy list. */
export function PeoplePage() {
  const t = useTranslations();
  const [tab, setTab] = useQueryChoice<Tab>("tab", TABS, "people");
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();
  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("people.search")} value={q} onChange={setQ}>
        <Segments
          label={t("nav.people")}
          value={tab}
          onChange={setTab}
          options={TABS.map((v) => ({ value: v, label: t(`people.tab.${v}` as const) }))}
        />
      </StickyBar>
      {tab === "people" ? <PeopleTab needle={needle} /> : <TrophyTab needle={needle} />}
    </Gate>
  );
}

function requirementText(
  t: ReturnType<typeof useTranslations>,
  r: Recruit["requirements"][number],
) {
  const qty = r.quantity && r.quantity > 1 ? `${r.quantity}× ` : "";
  switch (r.type) {
    case "give-item":
      return t("people.req.give", { what: `${qty}${nameOf("items", r.itemId)}` });
    case "show-item":
      return t("people.req.show", { what: nameOf("items", r.itemId) });
    case "show-weapon":
      return t("people.req.show", { what: nameOf("weapons", r.weaponId) });
    case "show-photo":
      return t("people.req.photo", { what: nameOf("photos", r.photoId) });
    case "catch-fish":
      return t("people.req.fish", {
        what: nameOf("fish", r.fishId),
        cm: r.minimumCentimeters ?? "?",
      });
    case "pay-gilda":
      return t("people.req.pay", { n: (r.quantity ?? 0).toLocaleString("en") });
    case "win-spheda":
      return t("people.req.spheda", { n: r.quantity ?? "?" }) + (r.text ? ` (${r.text})` : "");
    case "beat-time":
      return t("people.req.time", { s: r.seconds ?? "?" }) + (r.text ? ` (${r.text})` : "");
    case "enter-code":
      return t("people.req.code", { code: r.text ?? "" });
    default:
      return r.text ?? r.type;
  }
}

function PeopleTab({ needle }: { needle: string }) {
  const t = useTranslations();
  const recruitOf = new Map(collectables.recruits.map((r) => [r.npcId, r]));
  const shown = misc.npcs
    .filter((n) =>
      matches(
        needle,
        n.name,
        nameOf("towns", n.homeTownId),
        ...n.skills.map((s) => s.name),
        recruitOf.get(n.id)?.questName,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!shown.length) return <Empty>{t("reference.noMatch")}</Empty>;
  return (
    <Section title={t("people.tab.people")} meta={t("reference.count", { n: shown.length })}>
      {shown.map((n) => {
        const r = recruitOf.get(n.id);
        return (
          <Row
            key={n.id}
            title={n.name}
            aside={
              <>
                {n.homeTownId && <span>{nameOf("towns", n.homeTownId)}</span>}
                {n.maxSkillPoints != null && (
                  <span className="text-muted-foreground">
                    {t("people.sp", { n: n.maxSkillPoints })}
                  </span>
                )}
              </>
            }
          >
            {n.skills.length > 0 && (
              <Chips>
                {n.skills.map((s) => (
                  <Chip key={s.id} title={s.description ?? undefined}>
                    {s.name}
                    {s.skillPointCost != null &&
                      ` · ${t("people.skillSp", { n: s.skillPointCost })}`}
                  </Chip>
                ))}
              </Chips>
            )}
            {n.skills.some((s) => s.description) && (
              <Detail>
                {n.skills
                  .filter((s) => s.description)
                  .map((s) => `${s.name}: ${s.description}`)
                  .join(" · ")}
              </Detail>
            )}
            {r && (
              <Detail>
                <span className="text-foreground font-semibold">
                  {t("people.recruit", { n: r.chapterNumber ?? "?" })}
                </span>{" "}
                {[
                  r.questName && `“${r.questName}”`,
                  r.location,
                  ...r.requirements.map((x) => requirementText(t, x)),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Detail>
            )}
          </Row>
        );
      })}
    </Section>
  );
}

function TrophyTab({ needle }: { needle: string }) {
  const t = useTranslations();
  const shown = [...misc.trophies]
    .sort((a, b) => a.position - b.position)
    .filter((x) => matches(needle, x.name, x.description));
  if (!shown.length) return <Empty>{t("reference.noMatch")}</Empty>;
  return (
    <Section title={t("people.tab.trophies")} meta={t("reference.count", { n: shown.length })}>
      {shown.map((x) => (
        <Row
          key={x.id}
          title={x.name}
          aside={
            <Chip tone={x.tier === "platinum" || x.tier === "gold" ? "accent" : "plain"}>
              {t(`trophy.${x.tier}` as const)}
            </Chip>
          }
        >
          <Detail>{x.description}</Detail>
          {x.weapons && x.weapons.length > 0 && (
            <Detail>{x.weapons.map((w) => nameOf("weapons", w)).join(", ")}</Detail>
          )}
        </Row>
      ))}
    </Section>
  );
}
