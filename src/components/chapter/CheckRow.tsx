import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  badges?: ReactNode;
  detail?: ReactNode;
  /** Shorter rows for long lists (tap target stays around 36px). */
  dense?: boolean;
  /** Right-aligned column (numbers). */
  aside?: ReactNode;
}

/** A single big-tap-target checklist row. */
export function CheckRow({ checked, onChange, label, badges, detail, dense, aside }: Props) {
  return (
    <label
      className={cn(
        "hover:bg-muted/50 flex cursor-pointer items-start rounded-md px-2",
        dense ? "min-h-9 gap-2.5 py-1.5" : "min-h-11 gap-3 py-2",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
            checked && "text-muted-foreground line-through",
          )}
        >
          {label}
          {badges}
        </span>
        {detail ? <span className="text-muted-foreground text-xs">{detail}</span> : null}
      </span>
      {aside ? <span className="shrink-0 text-right text-xs tabular-nums">{aside}</span> : null}
    </label>
  );
}
