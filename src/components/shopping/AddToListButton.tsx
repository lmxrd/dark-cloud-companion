import { useEffect, useState } from "react";
import { CheckIcon, ShoppingCartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n";
import type { GoalInput } from "@/lib/shopping";
import { addShoppingGoal } from "@/lib/store";

/** Adds a goal to the shopping list and briefly confirms it. `onAdd` replaces the default action. */
export function AddToListButton({
  goal,
  label,
  onAdd,
  disabled,
  size = "xs",
  variant = "outline",
  name,
}: {
  /** Icon-only button for list rows; the accessible label names the thing. */
  name?: string;
  goal?: GoalInput;
  label?: string;
  onAdd?: () => void;
  disabled?: boolean;
  size?: "xs" | "sm";
  variant?: "outline" | "default";
}) {
  const t = useTranslations();
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const id = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(id);
  }, [added]);
  const text = label ?? (name ? t("shopping.addNamed", { name }) : t("shopping.addToList"));
  return (
    <Button
      type="button"
      size={name ? "icon-xs" : size}
      title={name ? text : undefined}
      variant={variant}
      disabled={disabled}
      aria-label={added ? `${t("shopping.added")}: ${text}` : text}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onAdd) onAdd();
        else if (goal) addShoppingGoal(goal);
        setAdded(true);
      }}
    >
      {added ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <ShoppingCartIcon data-icon="inline-start" />
      )}
      {name ? (
        added && (
          <span role="status" className="sr-only">
            {t("shopping.added")}
          </span>
        )
      ) : (
        <span role={added ? "status" : undefined}>{added ? t("shopping.added") : text}</span>
      )}
    </Button>
  );
}
