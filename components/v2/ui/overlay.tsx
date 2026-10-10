"use client";

import type { ReactElement, ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

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
        <BaseTooltip.Positioner side={side} sideOffset={6} className="z-70">
          <BaseTooltip.Popup className="pop rounded-md px-2 py-1 text-xs text-ink">
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
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
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <BasePopover.Trigger render={trigger} />}
      <BasePopover.Portal>
        <BasePopover.Positioner
          side={side}
          align={align}
          sideOffset={6}
          anchor={anchor}
          collisionPadding={8}
          className="z-60"
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
  "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-ink outline-none data-highlighted:bg-hover data-disabled:opacity-50";

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
          className="z-60"
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
      <span className="flex size-3.5 items-center justify-center">
        <BaseMenu.CheckboxItemIndicator>
          <Check className="size-3.5 text-accent" />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      {children}
    </BaseMenu.CheckboxItem>
  );
}

export const MenuSeparator = () => (
  <BaseMenu.Separator className="mx-1 my-1 h-px bg-line" />
);

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-1.5 text-[0.6875rem] font-medium text-ink-3">
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
  return (
    <BaseSelect.Root
      items={options}
      value={value}
      onValueChange={(v) => onChange((v as string | null) ?? null)}
      disabled={disabled}
      modal={false}
    >
      <BaseSelect.Trigger
        aria-label={label}
        className={cn(
          "press hover-bg flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-surface text-left text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] data-disabled:opacity-60",
          size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-[0.8125rem]",
          className,
        )}
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
          className="z-60"
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
        <BaseDialog.Backdrop className="scrim fixed inset-0 z-50" />
        <BaseDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <BaseDialog.Popup
            style={{ width: `min(${width}, 100%)` }}
            className="dlg flex max-h-full flex-col rounded-2xl outline-none"
          >
            <header className="flex items-start gap-3 px-5 pb-1 pt-4">
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
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
