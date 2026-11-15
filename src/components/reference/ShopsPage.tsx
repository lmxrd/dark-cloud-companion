import { useTranslations } from "@/i18n";
import { useQueryText } from "@/lib/url";
import { Gate } from "@/components/Gate";
import { shops } from "@/lib/gamedata/shops";
import { core } from "@/lib/gamedata";
import type { Shop, ShopStock } from "@/lib/gamedata/types";
import { Chip, Detail, Empty, matches, nameOf, Row, Section, StickyBar } from "./kit";

const stockName = (s: ShopStock) =>
  s.itemId
    ? nameOf("items", s.itemId)
    : s.weaponId
      ? nameOf("weapons", s.weaponId)
      : s.ridepodPartId
        ? nameOf("ridepodParts", s.ridepodPartId)
        : nameOf("ridepodCores", s.ridepodCoreId);

/** Every shop and seller with what they sell, by town; search finds a shop or anything it sells. */
export function ShopsPage() {
  const t = useTranslations();
  const [q, setQ] = useQueryText("q");
  const needle = q.trim().toLowerCase();

  const price = (shop: Shop, s: ShopStock) =>
    s.price == null
      ? t("shops.varies")
      : t(`shops.currency.${shop.currency}` as const, { n: s.price.toLocaleString("en") });

  // A shop matching by name shows all it sells; otherwise only the matching listings.
  const visible = shops.shops
    .map((shop) => ({
      shop,
      stock: matches(needle, shop.name, nameOf("npcs", shop.npcId))
        ? shop.stock
        : shop.stock.filter((s) => matches(needle, stockName(s))),
    }))
    .filter((v) => v.stock.length > 0);

  const towns = [...core.towns.map((tw) => tw.id), ""];
  const byTown = towns
    .map((id) => ({ id, list: visible.filter((v) => (v.shop.townId ?? "") === id) }))
    .filter((g) => g.list.length > 0);

  return (
    <Gate on={["url"]} className="flex flex-col gap-5">
      <StickyBar label={t("shops.search")} value={q} onChange={setQ} />
      {byTown.length === 0 && <Empty>{t("reference.noMatch")}</Empty>}
      {byTown.map((g) => (
        <div key={g.id} className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-extrabold tracking-tight">
            {g.id ? nameOf("towns", g.id) : t("shops.sellers")}
          </h2>
          {g.list.map(({ shop, stock }) => (
            <Section
              key={shop.id}
              title={shop.name}
              meta={[
                shop.npcId && nameOf("npcs", shop.npcId),
                shop.fromChapterNumber && t("reference.fromChapter", { n: shop.fromChapterNumber }),
                shop.afterRecruitNpcId &&
                  t("shops.afterRecruit", { npc: nameOf("npcs", shop.afterRecruitNpcId) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {stock.map((s) => (
                <Row
                  key={s.id}
                  title={stockName(s)}
                  aside={<span className="font-semibold">{price(shop, s)}</span>}
                >
                  {(s.purchaseLimit || s.fromChapterNumber || s.untilRecruitNpcId) && (
                    <Detail>
                      {[
                        s.purchaseLimit && t("shops.limit", { n: s.purchaseLimit }),
                        s.fromChapterNumber &&
                          t("reference.fromChapter", { n: s.fromChapterNumber }),
                        s.untilRecruitNpcId &&
                          t("shops.untilRecruit", { npc: nameOf("npcs", s.untilRecruitNpcId) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Detail>
                  )}
                  {(s.weaponId || s.ridepodPartId || s.ridepodCoreId) && (
                    <span>
                      <Chip tone="dashed">
                        {t(
                          s.weaponId
                            ? "shops.kind.weapon"
                            : s.ridepodPartId
                              ? "shops.kind.part"
                              : "shops.kind.core",
                        )}
                      </Chip>
                    </span>
                  )}
                </Row>
              ))}
            </Section>
          ))}
        </div>
      ))}
    </Gate>
  );
}
