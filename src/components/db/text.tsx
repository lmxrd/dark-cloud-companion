// Wording of database rows that several pages share: item effects, recruit and housing requirements.
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { Item, Recruit } from "@/lib/gamedata/types";
import { names } from "@/lib/gamedata";
import { dbHref, monsterFormHref } from "@/lib/db/routes";
import { Ref } from "./kit";

type Effect = Item["effects"][number];

/** One effect of an item, in words ("Heals 50 HP", "Cures poison", "Damage: flame, large area"). */
export function effectText(t: Translate, e: Effect): string {
  const status = e.status ? t(`db.status.${e.status}` as const) : "";
  const parts: string[] = [];
  switch (e.effect) {
    case "heal":
      parts.push(e.amount ? t("db.effect.healN", { n: e.amount }) : t("db.effect.healAll"));
      break;
    case "cause-status":
    case "cure-status":
    case "prevent-status":
    case "inflict-status":
      parts.push(t(`db.effect.${e.effect}` as const, { status }));
      break;
    case "damage":
      parts.push(e.amount ? t("db.effect.damageN", { n: e.amount }) : t("db.effect.damage"));
      if (e.element) parts.push(t(`stat.${shortStat(e.element)}` as const));
      break;
    default:
      parts.push(t(`db.effect.${e.effect}` as const));
  }
  if (e.area) parts.push(t(`db.area.${e.area}` as const));
  if (e.target && e.effect !== "damage") parts.push(t(`db.target.${e.target}` as const));
  if (e.floor) parts.push(t(`db.hazard.${e.floor}` as const));
  return parts.join(" · ");
}

const SHORT = {
  flame: "fl",
  chill: "ch",
  lightning: "li",
  cyclone: "cy",
  smash: "sm",
  exorcism: "ex",
  beast: "be",
  scale: "sc",
} as const;
/** The app's stat key for an element name. */
export const shortStat = (element: keyof typeof SHORT) => SHORT[element];

/** What recruiting someone takes, with links to the things it names. */
export function requirementText(t: Translate, r: Recruit["requirements"][number]): ReactNode {
  const qty = r.quantity && r.quantity > 1 ? `${r.quantity}× ` : "";
  const item = r.itemId && <Ref href={dbHref("item", r.itemId)}>{names.items[r.itemId]}</Ref>;
  switch (r.type) {
    case "give-item":
      return (
        <>
          {t("db.req.give")} {qty}
          {item}
        </>
      );
    case "show-item":
      return (
        <>
          {t("db.req.show")} {item}
        </>
      );
    case "show-weapon":
      return (
        <>
          {t("db.req.show")}{" "}
          <Ref href={dbHref("weapon", r.weaponId!)}>{names.weapons[r.weaponId!]}</Ref>
        </>
      );
    case "show-photo":
      return (
        <>
          {t("db.req.showPhoto")}{" "}
          <Ref href={dbHref("photo", r.photoId!)}>{names.photos[r.photoId!]}</Ref>
        </>
      );
    case "catch-fish":
      return (
        <>
          {t("db.req.catch")} <Ref href={dbHref("fish", r.fishId!)}>{names.fish[r.fishId!]}</Ref>{" "}
          {r.minimumCentimeters ? t("db.req.cm", { cm: r.minimumCentimeters }) : ""}
        </>
      );
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

/** A monster form, linked under its class. */
export const FormRef = ({ classId, id, name }: { classId: string; id: string; name: string }) => (
  <Ref href={monsterFormHref(classId, id)}>{name}</Ref>
);
