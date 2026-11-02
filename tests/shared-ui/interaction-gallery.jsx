import * as UI from "./wrappers";
import {
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

export function InteractionGallery() {
  return (
    <section
      className="gallery-section"
      aria-label="Interaction defaults"
      data-testid="interaction-defaults"
    >
      <h2>Interaction defaults</h2>
      <div className="gallery-stack">
        <div className="gallery-row">
          <UI.Button variant="ghost" data-testid="action-text">
            <span data-label>Text action</span>
          </UI.Button>
          <UI.Button
            variant="ghost"
            size="icon"
            aria-label="Icon action"
            data-testid="action-icon"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5v14" fill="none" stroke="currentColor" />
            </svg>
          </UI.Button>
          <a
            href="#interaction-defaults"
            className={UI.buttonVariants({ variant: "ghost" })}
            aria-current="page"
            data-testid="action-current"
          >
            <span data-label>Current page</span>
          </a>
          <UI.Button variant="ghost" disabled data-testid="action-disabled">
            Disabled action
          </UI.Button>
        </div>
        <div className="gallery-row">
          <UI.Select
            defaultValue="one"
            items={[{ value: "one", label: "Selection" }]}
          >
            <UI.SelectTrigger
              aria-label="Default selection"
              data-testid="field-select"
            >
              <UI.SelectValue data-label />
            </UI.SelectTrigger>
            <UI.SelectContent>
              <UI.SelectItem value="one">Selection</UI.SelectItem>
            </UI.SelectContent>
          </UI.Select>
          <UI.Combobox items={["Selection"]} defaultValue="Selection">
            <UI.ComboboxTrigger
              aria-label="Default combobox"
              data-testid="field-combobox"
            >
              <span data-label>
                <UI.ComboboxValue />
              </span>
            </UI.ComboboxTrigger>
            <UI.ComboboxContent>
              <UI.ComboboxList>
                {(item) => (
                  <UI.ComboboxItem key={item} value={item}>
                    {item}
                  </UI.ComboboxItem>
                )}
              </UI.ComboboxList>
            </UI.ComboboxContent>
          </UI.Combobox>
          <UI.Combobox items={["Selection"]}>
            <UI.ComboboxInput
              aria-label="Editable combobox"
              placeholder="Search selection"
              className="max-w-52"
            />
            <UI.ComboboxContent>
              <UI.ComboboxList>
                {(item) => (
                  <UI.ComboboxItem key={item} value={item}>
                    {item}
                  </UI.ComboboxItem>
                )}
              </UI.ComboboxList>
            </UI.ComboboxContent>
          </UI.Combobox>
        </div>
        <div className="gallery-row">
          <UI.Collapsible>
            <UI.CollapsibleTrigger data-testid="trigger-collapsible">
              <span data-label>Disclosure</span>
            </UI.CollapsibleTrigger>
            <UI.CollapsibleContent>Disclosure content</UI.CollapsibleContent>
          </UI.Collapsible>
          <UI.DropdownMenu>
            <UI.DropdownMenuTrigger data-testid="trigger-menu">
              <span data-label>Dropdown</span>
            </UI.DropdownMenuTrigger>
            <UI.DropdownMenuContent>
              <UI.DropdownMenuItem>Menu choice</UI.DropdownMenuItem>
            </UI.DropdownMenuContent>
          </UI.DropdownMenu>
          <UI.Popover>
            <UI.PopoverTrigger data-testid="trigger-popover">
              <span data-label>Popup</span>
            </UI.PopoverTrigger>
            <UI.PopoverContent>Popup content</UI.PopoverContent>
          </UI.Popover>
          <UI.Collapsible>
            <UI.CollapsibleTrigger
              render={<UI.Button variant="ghost" size="icon" />}
              data-testid="trigger-icon"
              aria-label="Icon disclosure"
            >
              +
            </UI.CollapsibleTrigger>
            <UI.CollapsibleContent>
              Icon disclosure content
            </UI.CollapsibleContent>
          </UI.Collapsible>
        </div>
        <div className="gallery-row">
          <UI.Input aria-label="Hover text field" className="max-w-52" />
          <UI.Textarea aria-label="Hover textarea" className="max-w-52" />
          <UI.NativeSelect aria-label="Hover native selection">
            <UI.NativeSelectOption>Selection</UI.NativeSelectOption>
          </UI.NativeSelect>
          <UI.Checkbox
            aria-label="Hover checkbox"
            data-testid="hover-checkbox"
          />
          <UI.RadioGroup aria-label="Hover choices" className="w-auto">
            <UI.RadioGroupItem
              value="one"
              aria-label="Hover radio"
              data-testid="hover-radio"
            />
          </UI.RadioGroup>
          <UI.Switch aria-label="Hover switch" data-testid="hover-switch" />
          <UI.Toggle data-testid="hover-toggle" defaultPressed>
            Selected toggle
          </UI.Toggle>
        </div>
        <div className="gallery-row">
          <UI.Dialog>
            <UI.DialogTrigger data-testid="trigger-dialog">
              <span data-label>Dialog</span>
            </UI.DialogTrigger>
            <UI.DialogContent>
              <UI.DialogTitle>Interaction dialog</UI.DialogTitle>
            </UI.DialogContent>
          </UI.Dialog>
          <UI.AlertDialog>
            <UI.AlertDialogTrigger data-testid="trigger-alert-dialog">
              <span data-label>Alert dialog</span>
            </UI.AlertDialogTrigger>
            <UI.AlertDialogContent>
              <UI.AlertDialogTitle>Interaction alert</UI.AlertDialogTitle>
              <UI.AlertDialogCancel>Cancel alert</UI.AlertDialogCancel>
            </UI.AlertDialogContent>
          </UI.AlertDialog>
          <UI.Sheet>
            <UI.SheetTrigger data-testid="trigger-sheet">
              <span data-label>Sheet</span>
            </UI.SheetTrigger>
            <UI.SheetContent>
              <UI.SheetTitle>Interaction sheet</UI.SheetTitle>
            </UI.SheetContent>
          </UI.Sheet>
          <UI.Drawer>
            <UI.DrawerTrigger data-testid="trigger-drawer">
              <span data-label>Drawer</span>
            </UI.DrawerTrigger>
            <UI.DrawerContent>
              <UI.DrawerTitle>Interaction drawer</UI.DrawerTitle>
              <UI.DrawerClose>Close drawer</UI.DrawerClose>
            </UI.DrawerContent>
          </UI.Drawer>
        </div>
        <div className="gallery-row">
          {["down", "up", "left", "right"].map((direction) => (
            <UI.Drawer key={direction} swipeDirection={direction}>
              <UI.DrawerTrigger data-testid={`drawer-direction-${direction}`}>
                Open {direction} drawer
              </UI.DrawerTrigger>
              <UI.DrawerContent>
                <UI.DrawerHeader>
                  <UI.DrawerTitle>
                    {direction} drawer orientation
                  </UI.DrawerTitle>
                </UI.DrawerHeader>
                <UI.DrawerFooter>
                  <UI.DrawerClose>Close orientation drawer</UI.DrawerClose>
                </UI.DrawerFooter>
              </UI.DrawerContent>
            </UI.Drawer>
          ))}
        </div>
        <div className="gallery-row">
          {["down", "up", "left", "right"].map((direction) => (
            <UI.Drawer
              key={direction}
              swipeDirection={direction}
              showSwipeHandle
            >
              <UI.DrawerTrigger data-testid={`drawer-explicit-${direction}`}>
                Open {direction} drawer with handle
              </UI.DrawerTrigger>
              <UI.DrawerContent>
                <UI.DrawerHeader>
                  <UI.DrawerTitle>
                    {direction} drawer explicit handle
                  </UI.DrawerTitle>
                </UI.DrawerHeader>
                <UI.DrawerFooter>
                  <UI.DrawerClose>Close orientation drawer</UI.DrawerClose>
                </UI.DrawerFooter>
              </UI.DrawerContent>
            </UI.Drawer>
          ))}
        </div>
        <TraceCollapsible>
          <TraceCollapsibleTrigger data-testid="trigger-trace">
            <TraceLine>
              <TraceTitle data-label>Thinking details</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>Reasoning details</TraceCollapsibleContent>
        </TraceCollapsible>
      </div>
    </section>
  );
}
