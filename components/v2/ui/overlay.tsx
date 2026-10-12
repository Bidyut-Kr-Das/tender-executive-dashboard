"use client";

import {
  cloneElement,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";
import { CheckMark, Input } from "./field";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/* ---------------------------------- Tooltip --------------------------------- */

export const TooltipProvider = BaseTooltip.Provider;

/** Visual label only: the trigger must already carry its accessible name. */
export function Tip({
  label,
  side = "top",
  children,
}: {
  label: ReactNode;
  side?: Side;
  children: ReactElement;
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className="z-(--z-tip)">
          <BaseTooltip.Popup className="pop rounded-md px-2 py-1 text-xs text-ink">
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

/* ------------------------------- Lazy mounting ------------------------------ */

type Armed = false | "hover" | "focus" | "click";

/**
 * A table mounts hundreds of selects and popovers as it scrolls, and each one
 * costs about twenty times a plain button. Until the user reaches for a
 * control, only its trigger is drawn; these handlers swap in the real one.
 */
function useArmed() {
  const [armed, setArmed] = useState<Armed>(false);
  return [
    armed,
    {
      // Mouse only: a tap must stay on one element from press to click.
      onPointerEnter: (e: PointerEvent) => {
        if (e.pointerType === "mouse") setArmed("hover");
      },
      // Keyboard only; the real trigger takes the focus over.
      onFocus: (e: FocusEvent) => {
        if (e.currentTarget.matches(":focus-visible")) setArmed("focus");
      },
      onClick: () => setArmed("click"),
    },
  ] as const;
}

/* ---------------------------------- Popover --------------------------------- */

export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  side = "bottom",
  align = "start",
  anchor,
  className,
}: {
  /** Omit when the popover is controlled and anchored to `anchor`. */
  trigger?: ReactElement;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: Side;
  align?: Align;
  anchor?: Element | null;
  className?: string;
}) {
  const [armed, arm] = useArmed();
  if (trigger && !armed && !open) {
    const own = trigger.props as { onClick?: (e: MouseEvent) => void };
    return cloneElement(trigger as ReactElement<Record<string, unknown>>, {
      ...arm,
      "aria-haspopup": "dialog",
      onClick: (e: MouseEvent) => {
        own.onClick?.(e);
        arm.onClick();
        onOpenChange?.(true);
      },
    });
  }
  return (
    <BasePopover.Root
      open={open}
      defaultOpen={open === undefined && armed === "click"}
      onOpenChange={onOpenChange}
    >
      {trigger && <BasePopover.Trigger render={trigger} autoFocus={armed === "focus"} />}
      <BasePopover.Portal>
        <BasePopover.Positioner
          side={side}
          align={align}
          sideOffset={6}
          anchor={anchor}
          collisionPadding={8}
          className="z-(--z-popup)"
        >
          <BasePopover.Popup
            className={cn(
              "pop max-h-(--available-height) max-w-[min(26rem,var(--available-width))] overflow-auto rounded-xl p-3 text-ink outline-none",
              className,
            )}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

/* ----------------------------------- Menu ----------------------------------- */

const ITEM =
  "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-md text-ink outline-none data-highlighted:bg-hover data-disabled:opacity-50";

export function Menu({
  trigger,
  children,
  side = "bottom",
  align = "start",
  className,
}: {
  trigger: ReactElement;
  children: ReactNode;
  side?: Side;
  align?: Align;
  className?: string;
}) {
  return (
    <BaseMenu.Root modal={false}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="z-(--z-popup)"
        >
          <BaseMenu.Popup
            className={cn(
              "pop max-h-(--available-height) min-w-44 overflow-auto rounded-xl p-1 outline-none",
              className,
            )}
          >
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  disabled,
  tone,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "bad";
}) {
  return (
    <BaseMenu.Item
      onClick={onClick}
      disabled={disabled}
      className={cn(ITEM, tone === "bad" && "text-bad")}
    >
      {icon && <span className="text-ink-3 [&>svg]:size-3.5">{icon}</span>}
      {children}
    </BaseMenu.Item>
  );
}

export function MenuCheckItem({
  checked,
  onCheckedChange,
  children,
  closeOnClick = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  closeOnClick?: boolean;
}) {
  return (
    <BaseMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      closeOnClick={closeOnClick}
      className={ITEM}
    >
      <CheckMark checked={checked} />
      {children}
    </BaseMenu.CheckboxItem>
  );
}

export const MenuSeparator = () => (
  <BaseMenu.Separator className="mx-1 my-1 h-px bg-line" />
);

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-1.5 type-label text-ink-3">
      {children}
    </div>
  );
}

/* ---------------------------------- Select ---------------------------------- */

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled,
  label,
  size = "md",
  className,
  icon,
}: {
  /** null means nothing selected. */
  value: string | null;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name when no visible label is rendered. */
  label: string;
  size?: "sm" | "md";
  className?: string;
  icon?: ReactNode;
}) {
  const [armed, arm] = useArmed();
  const triggerClass = cn(
    "press not-disabled:hover:bg-hover flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-surface text-left text-ink edge disabled:opacity-50 data-disabled:opacity-50",
    size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-md",
    className,
  );
  if (!armed) {
    const shown = options.find((o) => o.value === value)?.label;
    return (
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        disabled={disabled}
        className={triggerClass}
        {...arm}
      >
        {icon}
        <span className={cn("min-w-0 flex-1 truncate", shown == null && "text-ink-3")}>
          {shown ?? placeholder}
        </span>
        <ChevronDown className="size-3.5 text-ink-3" />
      </button>
    );
  }
  return (
    <BaseSelect.Root
      items={options}
      value={value}
      onValueChange={(v) => onChange((v as string | null) ?? null)}
      disabled={disabled}
      modal={false}
      defaultOpen={armed === "click"}
    >
      <BaseSelect.Trigger
        aria-label={label}
        autoFocus={armed === "focus"}
        className={triggerClass}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate data-placeholder:text-ink-3">
          <BaseSelect.Value placeholder={placeholder} />
        </span>
        <BaseSelect.Icon className="text-ink-3">
          <ChevronDown className="size-3.5" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          sideOffset={6}
          collisionPadding={8}
          className="z-(--z-popup)"
        >
          <BaseSelect.Popup className="pop max-h-[min(20rem,var(--available-height))] min-w-(--anchor-width) overflow-auto rounded-xl p-1 outline-none">
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item key={o.value} value={o.value} className={ITEM}>
                  <BaseSelect.ItemText className="flex-1">
                    {o.label}
                  </BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator>
                    <Check className="size-3.5 text-accent" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

/* ---------------------------------- Dialog ---------------------------------- */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "32rem",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="scrim fixed inset-0 z-(--z-modal)" />
        <BaseDialog.Viewport className="fixed inset-0 z-(--z-modal) grid place-items-center p-4">
          <BaseDialog.Popup
            style={{ width: `min(${width}, 100%)` }}
            className="dlg flex max-h-full flex-col rounded-2xl outline-none"
          >
            <header className="flex items-start gap-3 px-5 pb-1 pt-4">
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="type-title">
                  {title}
                </BaseDialog.Title>
                {description && (
                  <BaseDialog.Description className="mt-0.5 text-ink-2">
                    {description}
                  </BaseDialog.Description>
                )}
              </div>
              <BaseDialog.Close
                render={
                  <IconButton label="Close" size="sm">
                    <X className="size-4" />
                  </IconButton>
                }
              />
            </header>
            {children && (
              <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
                {children}
              </div>
            )}
            {footer && (
              <footer className="flex justify-end gap-2 px-5 pb-4 pt-2">
                {footer}
              </footer>
            )}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/* --------------------------------- Combobox --------------------------------- */

// ponytail: the list shows the first matches only and has no arrow-key
// navigation (Tab reaches the options, Enter picks the first). Move to
// base-ui Combobox if a list needs more.
const MAX_SHOWN = 100;

/** `Select` for a list too long to scan: type to narrow it. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled,
  label,
  size = "md",
  className,
}: {
  /** null means nothing selected. */
  value: string | null;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name; also the search box's placeholder. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // A saved value that has left the list still shows.
  const shown = options.find((o) => o.value === value)?.label ?? value ?? undefined;

  const pick = (next: string | null) => {
    setOpen(false);
    setQuery("");
    if (next !== value) onChange(next);
  };

  const q = query.trim().toLowerCase();
  const matching = open
    ? (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, MAX_SHOWN)
    : [];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      className="flex w-64 flex-col gap-2 p-2"
      trigger={
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={cn(
            "press not-disabled:hover:bg-hover flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-surface text-left text-ink edge disabled:opacity-50",
            size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-md",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", shown == null && "text-ink-3")}>
            {shown ?? placeholder}
          </span>
          <ChevronDown className="size-3.5 text-ink-3" />
        </button>
      }
    >
      <Input
        autoFocus
        aria-label={`Search ${label}`}
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matching[0]) pick(matching[0].value);
        }}
      />
      <ul className="-mx-1 flex max-h-64 flex-col overflow-y-auto">
        {value != null && !q && (
          <li>
            <button type="button" onClick={() => pick(null)} className={cn(ITEM, "w-full text-ink-3 hover:bg-hover")}>
              Not set
            </button>
          </li>
        )}
        {matching.map((o) => (
          <li key={o.value}>
            <button type="button" onClick={() => pick(o.value)} className={cn(ITEM, "w-full text-left hover:bg-hover")}>
              <span className="min-w-0 flex-1 wrap-break-word">{o.label}</span>
              {o.value === value && <Check className="size-3.5 text-accent" />}
            </button>
          </li>
        ))}
        {matching.length === 0 && <li className="px-2 py-1.5 text-ink-3">No matches</li>}
      </ul>
    </Popover>
  );
}
