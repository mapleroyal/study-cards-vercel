import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";
import { SurfaceViewport } from "@/components/surface-viewport";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

function Menubar({ className, ...props }) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "flex h-9 items-center gap-1 rounded-3xl border border-transparent bg-input/50 p-1",
        className,
      )}
      {...props}
    />
  );
}

function MenubarMenu({ ...props }) {
  return <MenuPrimitive.Root data-slot="menubar-menu" {...props} />;
}

function MenubarGroup({ ...props }) {
  return <MenuPrimitive.Group data-slot="menubar-group" {...props} />;
}

function MenubarPortal({ ...props }) {
  return <MenuPrimitive.Portal data-slot="menubar-portal" {...props} />;
}

function MenubarRadioGroup({ ...props }) {
  return (
    <MenuPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
  );
}

function MenubarTrigger({ className, ...props }) {
  return (
    <MenuPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "text-label-lg flex items-center gap-2.5 rounded-2xl px-3 py-1 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  viewportClassName,
  children,
  align = "start",
  alignOffset = -4,
  side = "bottom",
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}) {
  return (
    <MenubarPortal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
      >
        <MenuPrimitive.Popup
          data-slot="menubar-content"
          className={cn(
            "z-50 flex flex-col max-h-(--available-height) min-w-48 max-w-[calc(100vw-1rem)] origin-(--transform-origin) [--surface-radius:--theme(--radius-3xl)] rounded-(--surface-radius) bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SurfaceViewport className={cn("p-1.5", viewportClassName)}>
            {children}
          </SurfaceViewport>
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenubarPortal>
  );
}

function MenubarItem({ className, inset, variant = "default", ...props }) {
  return (
    <MenuPrimitive.Item
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/menubar-item text-label-lg relative flex cursor-default items-center gap-2.5 rounded-2xl px-3 py-2 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-inset:pl-9.5 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function MenubarCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      data-inset={inset}
      className={cn(
        "text-label-lg relative flex cursor-default items-center gap-2.5 rounded-2xl py-2 pr-3 pl-9.5 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-3 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <MenuPrimitive.CheckboxItemIndicator>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function MenubarRadioItem({ className, children, inset, ...props }) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menubar-radio-item"
      data-inset={inset}
      className={cn(
        "text-label-lg relative flex cursor-default items-center gap-2.5 rounded-2xl py-2 pr-3 pl-9.5 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-3 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <MenuPrimitive.RadioItemIndicator>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function MenubarLabel({ className, inset, ...props }) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "text-body-sm px-3 py-2.5 text-muted-foreground data-inset:pl-9.5",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSeparator({ className, ...props }) {
  return (
    <MenuPrimitive.Separator
      data-slot="menubar-separator"
      className={cn("-mx-1.5 my-1.5 h-px bg-border/50", className)}
      {...props}
    />
  );
}

function MenubarShortcut({ className, ...props }) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "text-body-sm ml-auto tracking-widest text-muted-foreground group-data-highlighted/menubar-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSub({ ...props }) {
  return <MenuPrimitive.SubmenuRoot data-slot="menubar-sub" {...props} />;
}

function MenubarSubTrigger({ className, inset, children, ...props }) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "text-label-lg flex cursor-default items-center gap-2 rounded-2xl px-3 py-2 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:pl-9.5 data-open:bg-accent data-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        className="ml-auto size-4"
      />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function MenubarSubContent({ className, ...props }) {
  return (
    <MenubarContent
      data-slot="menubar-sub-content"
      side="inline-end"
      alignOffset={-4}
      sideOffset={-4}
      className={cn("min-w-36", className)}
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
