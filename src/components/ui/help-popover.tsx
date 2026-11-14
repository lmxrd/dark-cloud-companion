import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleHelpIcon } from "lucide-react";
import { cn } from "cn";

/**
 * A small "?" that explains something: opens while the mouse is over it, and on tap (phones) or
 * keyboard; closes on leaving, a second tap, Escape or a tap elsewhere.
 */
export function HelpPopover({
  label,
  children,
  className,
}: {
  /** Accessible name of the button ("About abilities"). */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  /** How the last press came in: a mouse already opened it by hovering, so its click keeps it open. */
  const pointer = useRef<string>("");
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span
      ref={root}
      className="relative inline-flex"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onClick={() => {
          if (pointer.current === "mouse") setOpen(true);
          else setOpen((o) => !o);
          pointer.current = "";
        }}
        className="text-muted-foreground hover:text-foreground rounded-full"
      >
        <CircleHelpIcon className="size-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            "bg-popover text-popover-foreground shadow-sticker absolute top-6 left-0 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border-2 p-3 text-xs font-normal",
            className,
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
