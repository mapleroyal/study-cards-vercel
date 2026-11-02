import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "@/components/ui/toast";
import { InteractionGallery } from "./interaction-gallery";
import { TypesetGallery } from "./typeset-gallery";
import { AiGallery } from "./ai-gallery";
import { ScrollbarGallery } from "./scrollbar-gallery";
import * as UI from "./wrappers";
import { AppearanceModeControl } from "@/components/theme/appearance-mode-control";
import { registerAppCorners } from "@/lib/app-corners";
import "./gallery.css";
const theme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
document.documentElement.classList.toggle("dark", theme === "dark");
registerAppCorners({
  force: new window.URLSearchParams(window.location.search).has(
    "corner-fallback",
  ),
});
function Section({ title, components, children }) {
  return (
    <section
      className="gallery-section"
      data-components={components}
      aria-label={title}
    >
      <h2>{title}</h2>
      <div className="gallery-stack">{children}</div>
    </section>
  );
}
const formats = [
  {
    value: "markdown",
    label: "Markdown",
  },
  {
    value: "plain",
    label: "Plain text",
  },
  {
    value: "pdf",
    label: "PDF export",
  },
  {
    value: "long",
    label:
      "A very long document format name that should never escape the available space",
  },
];
function FormatSelect({ grouped = false, ...props }) {
  const items = formats.map((item) => (
    <UI.SelectItem
      key={item.value}
      value={item.value}
      disabled={item.value === "pdf"}
    >
      {item.label}
    </UI.SelectItem>
  ));
  return (
    <UI.Select defaultValue="markdown" items={formats}>
      <UI.SelectTrigger
        aria-label={grouped ? "Grouped format" : "Document format"}
        className="max-w-52"
        {...props}
      >
        <UI.SelectValue />
      </UI.SelectTrigger>
      <UI.SelectContent>
        {grouped ? (
          <UI.SelectGroup>
            <UI.SelectLabel>Formats</UI.SelectLabel>
            {items}
          </UI.SelectGroup>
        ) : (
          items
        )}
      </UI.SelectContent>
    </UI.Select>
  );
}
function Menus() {
  return (
    <Section title="Menus" components="dropdown-menu context-menu menubar">
      <div className="gallery-row">
        <UI.DropdownMenu>
          <UI.DropdownMenuTrigger render={<UI.Button variant="outline" />}>
            Document actions
          </UI.DropdownMenuTrigger>
          <UI.DropdownMenuContent>
            <UI.DropdownMenuGroup>
              <UI.DropdownMenuLabel>Document</UI.DropdownMenuLabel>
              <UI.DropdownMenuItem>
                Rename<UI.DropdownMenuShortcut>⌘R</UI.DropdownMenuShortcut>
              </UI.DropdownMenuItem>
              <UI.DropdownMenuItem disabled>
                Unavailable action
              </UI.DropdownMenuItem>
            </UI.DropdownMenuGroup>
            <UI.DropdownMenuSeparator />
            <UI.DropdownMenuCheckboxItem defaultChecked>
              Word wrap
            </UI.DropdownMenuCheckboxItem>
            <UI.DropdownMenuRadioGroup defaultValue="normal">
              <UI.DropdownMenuRadioItem value="normal">
                Normal text
              </UI.DropdownMenuRadioItem>
              <UI.DropdownMenuRadioItem value="large">
                Large text
              </UI.DropdownMenuRadioItem>
            </UI.DropdownMenuRadioGroup>
            <UI.DropdownMenuSub>
              <UI.DropdownMenuSubTrigger>Export as</UI.DropdownMenuSubTrigger>
              <UI.DropdownMenuSubContent>
                <UI.DropdownMenuItem>HTML document</UI.DropdownMenuItem>
              </UI.DropdownMenuSubContent>
            </UI.DropdownMenuSub>
            <UI.DropdownMenuItem variant="destructive">
              Delete document
            </UI.DropdownMenuItem>
          </UI.DropdownMenuContent>
        </UI.DropdownMenu>
        <UI.Menubar>
          <UI.MenubarMenu>
            <UI.MenubarTrigger>File menu</UI.MenubarTrigger>
            <UI.MenubarContent>
              <UI.MenubarGroup>
                <UI.MenubarLabel>File</UI.MenubarLabel>
                <UI.MenubarItem>
                  New document<UI.MenubarShortcut>⌘N</UI.MenubarShortcut>
                </UI.MenubarItem>
                <UI.MenubarItem disabled>Print document</UI.MenubarItem>
              </UI.MenubarGroup>
              <UI.MenubarSeparator />
              <UI.MenubarCheckboxItem checked>
                Show outline
              </UI.MenubarCheckboxItem>
              <UI.MenubarRadioGroup value="local">
                <UI.MenubarRadioItem value="local">
                  Local files
                </UI.MenubarRadioItem>
              </UI.MenubarRadioGroup>
              <UI.MenubarSub>
                <UI.MenubarSubTrigger>Recent files</UI.MenubarSubTrigger>
                <UI.MenubarSubContent>
                  <UI.MenubarItem>Notes.md</UI.MenubarItem>
                </UI.MenubarSubContent>
              </UI.MenubarSub>
            </UI.MenubarContent>
          </UI.MenubarMenu>
        </UI.Menubar>
      </div>
      <UI.ContextMenu>
        <UI.ContextMenuTrigger className="gallery-context">
          Right click for document actions
        </UI.ContextMenuTrigger>
        <UI.ContextMenuContent>
          <UI.ContextMenuGroup>
            <UI.ContextMenuLabel>Document</UI.ContextMenuLabel>
            <UI.ContextMenuItem>
              Copy path<UI.ContextMenuShortcut>⌘C</UI.ContextMenuShortcut>
            </UI.ContextMenuItem>
            <UI.ContextMenuItem disabled>Move to trash</UI.ContextMenuItem>
          </UI.ContextMenuGroup>
          <UI.ContextMenuSeparator />
          <UI.ContextMenuCheckboxItem checked>
            Show status
          </UI.ContextMenuCheckboxItem>
          <UI.ContextMenuRadioGroup value="name">
            <UI.ContextMenuRadioItem value="name">
              Sort by name
            </UI.ContextMenuRadioItem>
          </UI.ContextMenuRadioGroup>
          <UI.ContextMenuSub>
            <UI.ContextMenuSubTrigger>Open with</UI.ContextMenuSubTrigger>
            <UI.ContextMenuSubContent>
              <UI.ContextMenuItem>Text editor</UI.ContextMenuItem>
            </UI.ContextMenuSubContent>
          </UI.ContextMenuSub>
        </UI.ContextMenuContent>
      </UI.ContextMenu>
    </Section>
  );
}
function Overlays() {
  const [commandOpen, setCommandOpen] = useState(false);
  return (
    <Section
      title="Overlays"
      components="dialog alert-dialog sheet drawer popover hover-card tooltip"
    >
      <div className="gallery-row">
        <UI.Button variant="outline" onClick={() => setCommandOpen(true)}>
          Open command palette
        </UI.Button>
        <UI.CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <UI.CommandInput placeholder="Search all commands" />
          <UI.CommandList>
            {Array.from(
              {
                length: 30,
              },
              (_, index) => (
                <UI.CommandItem key={index}>
                  Document command {index + 1}
                </UI.CommandItem>
              ),
            )}
          </UI.CommandList>
        </UI.CommandDialog>
        <UI.Dialog>
          <UI.DialogTrigger render={<UI.Button variant="outline" />}>
            Edit document
          </UI.DialogTrigger>
          <UI.DialogContent>
            <UI.DialogHeader>
              <UI.DialogTitle>Edit document</UI.DialogTitle>
              <UI.DialogDescription>Document settings</UI.DialogDescription>
            </UI.DialogHeader>
            <UI.Label htmlFor="dialog-title">Title</UI.Label>
            <UI.Input id="dialog-title" defaultValue="Notes" />
            <UI.Select
              defaultValue="plain"
              items={[
                {
                  value: "plain",
                  label: "Plain text",
                },
                {
                  value: "markdown",
                  label: "Markdown",
                },
              ]}
            >
              <UI.SelectTrigger aria-label="Document format">
                <UI.SelectValue />
              </UI.SelectTrigger>
              <UI.SelectContent>
                <UI.SelectItem value="plain">Plain text</UI.SelectItem>
                <UI.SelectItem value="markdown">Markdown</UI.SelectItem>
              </UI.SelectContent>
            </UI.Select>
            <UI.Combobox items={["Personal", "Work", "Finance"]}>
              <UI.ComboboxInput aria-label="Document folder" />
              <UI.ComboboxContent>
                <UI.ComboboxEmpty>No folders</UI.ComboboxEmpty>
                <UI.ComboboxList>
                  {(item) => (
                    <UI.ComboboxItem key={item} value={item}>
                      {item}
                    </UI.ComboboxItem>
                  )}
                </UI.ComboboxList>
              </UI.ComboboxContent>
            </UI.Combobox>
            <UI.Popover>
              <UI.PopoverTrigger render={<UI.Button variant="outline" />}>
                Choose document date
              </UI.PopoverTrigger>
              <UI.PopoverContent
                aria-label="Document date"
                className="w-auto"
                viewportClassName="p-0"
              >
                <UI.Calendar
                  mode="single"
                  defaultMonth={new Date(2026, 5, 15)}
                />
              </UI.PopoverContent>
            </UI.Popover>
            <UI.DialogFooter>
              <UI.DialogClose render={<UI.Button />}>
                Save changes
              </UI.DialogClose>
            </UI.DialogFooter>
          </UI.DialogContent>
        </UI.Dialog>
        <UI.AlertDialog>
          <UI.AlertDialogTrigger render={<UI.Button variant="destructive" />}>
            Delete draft
          </UI.AlertDialogTrigger>
          <UI.AlertDialogContent>
            <UI.AlertDialogHeader>
              <UI.AlertDialogTitle>Delete draft?</UI.AlertDialogTitle>
              <UI.AlertDialogDescription>
                This draft will be removed.
              </UI.AlertDialogDescription>
            </UI.AlertDialogHeader>
            <UI.AlertDialogFooter>
              <UI.AlertDialogCancel>Cancel deletion</UI.AlertDialogCancel>
              <UI.AlertDialogAction>Confirm deletion</UI.AlertDialogAction>
            </UI.AlertDialogFooter>
          </UI.AlertDialogContent>
        </UI.AlertDialog>
        <UI.Sheet>
          <UI.SheetTrigger render={<UI.Button variant="outline" />}>
            Open inspector
          </UI.SheetTrigger>
          <UI.SheetContent>
            <UI.SheetHeader>
              <UI.SheetTitle>Inspector</UI.SheetTitle>
              <UI.SheetDescription>Document metadata</UI.SheetDescription>
            </UI.SheetHeader>
            <UI.SheetFooter>
              <UI.SheetClose render={<UI.Button />}>Done</UI.SheetClose>
            </UI.SheetFooter>
          </UI.SheetContent>
        </UI.Sheet>
        <UI.Drawer>
          <UI.DrawerTrigger render={<UI.Button variant="outline" />}>
            Open drawer
          </UI.DrawerTrigger>
          <UI.DrawerContent>
            <UI.DrawerHeader>
              <UI.DrawerTitle>Recent documents</UI.DrawerTitle>
              <UI.DrawerDescription>Your recent files</UI.DrawerDescription>
            </UI.DrawerHeader>
            <UI.DrawerFooter>
              <UI.DrawerClose render={<UI.Button />}>
                Close drawer
              </UI.DrawerClose>
            </UI.DrawerFooter>
          </UI.DrawerContent>
        </UI.Drawer>
        <UI.Popover>
          <UI.PopoverTrigger render={<UI.Button variant="outline" />}>
            Document info
          </UI.PopoverTrigger>
          <UI.PopoverContent>
            <UI.PopoverHeader>
              <UI.PopoverTitle>Notes.md</UI.PopoverTitle>
              <UI.PopoverDescription>Markdown document</UI.PopoverDescription>
            </UI.PopoverHeader>
            <p>24 words</p>
          </UI.PopoverContent>
        </UI.Popover>
        <UI.HoverCard>
          <UI.HoverCardTrigger delay={0} render={<a href="#author" />}>
            Author details
          </UI.HoverCardTrigger>
          <UI.HoverCardContent>Document author</UI.HoverCardContent>
        </UI.HoverCard>
        <UI.Tooltip>
          <UI.TooltipTrigger render={<UI.Button variant="outline" />}>
            Preview shortcut
          </UI.TooltipTrigger>
          <UI.TooltipContent>
            Preview<UI.Kbd>⌘P</UI.Kbd>
          </UI.TooltipContent>
        </UI.Tooltip>
        <UI.Tooltip disableHoverablePopup={false}>
          <UI.TooltipTrigger render={<UI.Button variant="outline" />}>
            Hoverable hint
          </UI.TooltipTrigger>
          <UI.TooltipContent>Hoverable details</UI.TooltipContent>
        </UI.Tooltip>
      </div>
      <div className="gallery-row">
        {["top", "bottom", "left", "right"].map((side) => (
          <div key={side} className="grid h-36 w-64 place-items-center">
            <UI.Tooltip>
              <UI.TooltipTrigger render={<UI.Button variant="outline" />}>
                Pointer {side}
              </UI.TooltipTrigger>
              <UI.TooltipContent side={side}>Hint {side}</UI.TooltipContent>
            </UI.Tooltip>
          </div>
        ))}
      </div>
    </Section>
  );
}
function CornerFixtures() {
  return (
    <Section title="Corner rendering" components="corner-rendering">
      <div className="gallery-corner-stage" data-testid="corner-stage">
        <span className="rounded-4xl" data-testid="corner-shape-probe" />
        <span
          className="rounded-full"
          data-slot="corner-circle"
          data-testid="corner-circle-probe"
        />
      </div>
      <div className="gallery-corner-controls" data-testid="corner-controls">
        <UI.Input aria-label="Corner field" placeholder="Corner field" />
        <UI.Textarea aria-label="Corner notes" placeholder="Corner notes" />
        <UI.Toggle
          aria-label="Corner toggle"
          className="data-pressed:bg-primary data-pressed:text-primary-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          Pin
        </UI.Toggle>
        <FormatSelect aria-label="Corner format" />
      </div>
      <div className="gallery-corner-stage" data-testid="corner-card-stage">
        <UI.Card
          data-testid="corner-image-card"
          className="w-64 [--surface-radius:40px]"
          viewportClassName="p-0"
        >
          <img
            className="block h-24 w-full !rounded-none"
            alt="Corner clipping fixture"
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='96'%3E%3Cpath fill='%23ff0000' d='M0 0h256v96H0z'/%3E%3C/svg%3E"
          />
        </UI.Card>
      </div>
      <UI.Dialog>
        <UI.DialogTrigger render={<UI.Button variant="outline" />}>
          Corner dialog
        </UI.DialogTrigger>
        <UI.DialogContent data-testid="corner-dialog">
          <UI.DialogHeader>
            <UI.DialogTitle>Clipped footer</UI.DialogTitle>
            <UI.DialogDescription>
              Corner paint verification
            </UI.DialogDescription>
          </UI.DialogHeader>
          <UI.DialogFooter
            className="-mx-6 -mb-6 p-6"
            style={{
              backgroundColor: "#ff0000",
            }}
            data-testid="corner-footer"
          >
            <UI.DialogClose render={<UI.Button />}>
              Close corner dialog
            </UI.DialogClose>
          </UI.DialogFooter>
        </UI.DialogContent>
      </UI.Dialog>
    </Section>
  );
}
function Gallery() {
  const documentInput = useRef(null);
  const [appearance, setAppearance] = useState("system");
  const [date, setDate] = useState(new Date(2026, 8, 7));
  const [format, setFormat] = useState("Markdown");
  const choices = ["Markdown", "Plain text", "HTML", "PDF"];
  const chipsAnchor = UI.useComboboxAnchor();
  return (
    <UI.DirectionProvider dir="ltr">
      <UI.TooltipProvider delay={0}>
        <main className="gallery">
          <h1>Component verification</h1>
          <CornerFixtures />
          <Section title="Appearance" components="direction">
            <div className="gallery-row">
              <div
                data-testid="appearance-expanded"
                style={{
                  width: 180,
                }}
              >
                <AppearanceModeControl
                  value={appearance}
                  onValueChange={setAppearance}
                />
              </div>
              <div
                data-testid="appearance-compact"
                className="gallery-edge-control"
              >
                <AppearanceModeControl
                  value={appearance}
                  onValueChange={setAppearance}
                />
              </div>
            </div>
          </Section>
          <Section
            title="Form controls"
            components="button button-group input textarea label input-group native-select field input-otp"
          >
            <div className="gallery-row">
              {[
                "default",
                "secondary",
                "outline",
                "ghost",
                "destructive",
                "destructive-text",
                "link",
              ].map((variant) => (
                <UI.Button key={variant} variant={variant}>
                  {variant}
                </UI.Button>
              ))}
              <UI.Button disabled>Disabled button</UI.Button>
            </div>
            <div className="gallery-row">
              <UI.Button size="xs">Extra small</UI.Button>
              <UI.Button size="sm">Small</UI.Button>
              <UI.Button size="lg">Large</UI.Button>
              <UI.ButtonGroup>
                <UI.Button variant="outline">Undo</UI.Button>
                <UI.ButtonGroupSeparator />
                <UI.Button variant="outline">Redo</UI.Button>
                <UI.ButtonGroupText>History</UI.ButtonGroupText>
              </UI.ButtonGroup>
            </div>
            <div className="gallery-columns">
              <div className="gallery-stack">
                <div className="gallery-field">
                  <UI.Label htmlFor="name">Document name</UI.Label>
                  <UI.Input
                    id="name"
                    name="documentName"
                    ref={documentInput}
                    placeholder="Untitled"
                  />
                  <UI.Button
                    variant="outline"
                    onClick={() => documentInput.current?.focus()}
                  >
                    Focus document name
                  </UI.Button>
                </div>
                <UI.Input
                  aria-label="Disabled input"
                  disabled
                  value="Read only"
                />
                <UI.Input
                  aria-label="Invalid input"
                  aria-invalid="true"
                  defaultValue="Invalid name"
                />
                <UI.Input type="file" aria-label="Import file" />
                <UI.Textarea
                  aria-label="Document description"
                  name="description"
                  placeholder="Description"
                />
                <UI.InputGroup>
                  <UI.InputGroupAddon>
                    <UI.InputGroupText>https://</UI.InputGroupText>
                  </UI.InputGroupAddon>
                  <UI.InputGroupInput
                    aria-label="Document address"
                    placeholder="example.com"
                  />
                  <UI.InputGroupAddon align="inline-end">
                    <UI.InputGroupButton>Go</UI.InputGroupButton>
                  </UI.InputGroupAddon>
                </UI.InputGroup>
                <UI.InputGroup>
                  <UI.InputGroupTextarea
                    aria-label="Message"
                    placeholder="Write a message"
                  />
                  <UI.InputGroupAddon align="block-end">
                    <UI.InputGroupText>Markdown</UI.InputGroupText>
                    <UI.InputGroupButton>Send</UI.InputGroupButton>
                  </UI.InputGroupAddon>
                </UI.InputGroup>
              </div>
              <div className="gallery-stack">
                <div className="gallery-field">
                  <UI.Label htmlFor="native-format">Native format</UI.Label>
                  <UI.NativeSelect id="native-format" defaultValue="md">
                    <UI.NativeSelectOptGroup label="Text">
                      <UI.NativeSelectOption value="md">
                        Markdown
                      </UI.NativeSelectOption>
                      <UI.NativeSelectOption value="txt">
                        Plain text
                      </UI.NativeSelectOption>
                    </UI.NativeSelectOptGroup>
                  </UI.NativeSelect>
                </div>
                <UI.NativeSelect aria-label="Disabled native select" disabled>
                  <UI.NativeSelectOption>Unavailable</UI.NativeSelectOption>
                </UI.NativeSelect>
                <UI.FieldSet>
                  <UI.FieldLegend>Details</UI.FieldLegend>
                  <UI.FieldGroup>
                    <UI.Field>
                      <UI.FieldLabel htmlFor="field-name">
                        Filename
                      </UI.FieldLabel>
                      <UI.Input id="field-name" aria-invalid="true" />
                      <UI.FieldDescription>
                        Include a file extension.
                      </UI.FieldDescription>
                      <UI.FieldError>Filename is required.</UI.FieldError>
                    </UI.Field>
                    <UI.FieldSeparator />
                    <UI.Field orientation="horizontal">
                      <UI.Checkbox id="field-pinned" />
                      <UI.FieldContent>
                        <UI.FieldLabel htmlFor="field-pinned">
                          Pin document
                        </UI.FieldLabel>
                        <UI.FieldDescription>
                          Keep it in the sidebar.
                        </UI.FieldDescription>
                      </UI.FieldContent>
                    </UI.Field>
                  </UI.FieldGroup>
                </UI.FieldSet>
                <UI.InputOTP maxLength={6} aria-label="Verification code">
                  <UI.InputOTPGroup>
                    {[0, 1, 2].map((index) => (
                      <UI.InputOTPSlot key={index} index={index} />
                    ))}
                  </UI.InputOTPGroup>
                  <UI.InputOTPSeparator />
                  <UI.InputOTPGroup>
                    {[3, 4, 5].map((index) => (
                      <UI.InputOTPSlot key={index} index={index} />
                    ))}
                  </UI.InputOTPGroup>
                </UI.InputOTP>
              </div>
            </div>
          </Section>
          <Section
            title="Selection"
            components="select combobox checkbox radio-group switch slider toggle toggle-group"
          >
            <div className="gallery-columns">
              <div className="gallery-stack">
                <div className="gallery-field">
                  <UI.Label>Document format</UI.Label>
                  <FormatSelect />
                </div>
                <div className="gallery-field">
                  <UI.Label>Grouped format</UI.Label>
                  <FormatSelect grouped />
                </div>
                <FormatSelect disabled aria-label="Disabled format" />
                <UI.Select
                  defaultValue="document-1"
                  items={Array.from(
                    {
                      length: 40,
                    },
                    (_, index) => ({
                      value: `document-${index + 1}`,
                      label: `Document ${index + 1}`,
                    }),
                  )}
                >
                  <UI.SelectTrigger aria-label="Many documents">
                    <UI.SelectValue />
                  </UI.SelectTrigger>
                  <UI.SelectContent>
                    {Array.from(
                      {
                        length: 40,
                      },
                      (_, index) => (
                        <UI.SelectItem
                          key={index}
                          value={`document-${index + 1}`}
                        >
                          Document {index + 1}
                        </UI.SelectItem>
                      ),
                    )}
                  </UI.SelectContent>
                </UI.Select>
                <UI.Combobox
                  items={choices}
                  value={format}
                  onValueChange={setFormat}
                >
                  <UI.ComboboxInput aria-label="Search format" showClear />
                  <UI.ComboboxContent>
                    <UI.ComboboxEmpty>No matching formats.</UI.ComboboxEmpty>
                    <UI.ComboboxList>
                      {(item) => (
                        <UI.ComboboxItem key={item} value={item}>
                          {item}
                        </UI.ComboboxItem>
                      )}
                    </UI.ComboboxList>
                  </UI.ComboboxContent>
                </UI.Combobox>
                <div className="w-56 max-w-full">
                  <UI.Combobox
                    items={[
                      "Selected format with a long descriptive name",
                      "Unselected format with a long descriptive name",
                      "Custom format",
                    ]}
                    defaultValue="Selected format with a long descriptive name"
                  >
                    <UI.ComboboxInput aria-label="Long format" />
                    <UI.ComboboxContent>
                      <UI.ComboboxList>
                        {(item) => (
                          <UI.ComboboxItem key={item} value={item}>
                            {item === "Custom format" ? (
                              <>
                                <span data-testid="custom-format-label">
                                  {item}
                                </span>
                                <UI.Kbd>⌘C</UI.Kbd>
                              </>
                            ) : (
                              item
                            )}
                          </UI.ComboboxItem>
                        )}
                      </UI.ComboboxList>
                    </UI.ComboboxContent>
                  </UI.Combobox>
                </div>
                <UI.Combobox
                  multiple
                  items={choices}
                  defaultValue={["Markdown"]}
                >
                  <UI.ComboboxChips ref={chipsAnchor}>
                    <UI.ComboboxValue>
                      {(values) => (
                        <>
                          {values.map((value) => (
                            <UI.ComboboxChip key={value}>
                              {value}
                            </UI.ComboboxChip>
                          ))}
                          <UI.ComboboxChipsInput aria-label="Format tags" />
                        </>
                      )}
                    </UI.ComboboxValue>
                  </UI.ComboboxChips>
                  <UI.ComboboxContent anchor={chipsAnchor}>
                    <UI.ComboboxEmpty>No matching tags.</UI.ComboboxEmpty>
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
              <div className="gallery-stack">
                <div className="gallery-row">
                  <UI.Checkbox id="wrap" aria-label="Wrap lines" />
                  <UI.Label htmlFor="wrap">Wrap lines</UI.Label>
                  <UI.Checkbox aria-label="Mixed selection" indeterminate />
                  <UI.Checkbox aria-label="Disabled checkbox" disabled />
                </div>
                <UI.RadioGroup defaultValue="edit" aria-label="Editor mode">
                  <div className="gallery-row">
                    <UI.RadioGroupItem value="edit" id="edit" />
                    <UI.Label htmlFor="edit">Edit mode</UI.Label>
                    <UI.RadioGroupItem value="read" id="read" />
                    <UI.Label htmlFor="read">Read mode</UI.Label>
                  </div>
                </UI.RadioGroup>
                <div className="gallery-row">
                  <UI.Switch id="autosave" aria-label="Autosave" />
                  <UI.Label htmlFor="autosave">Autosave</UI.Label>
                  <UI.Switch
                    size="sm"
                    defaultChecked
                    aria-label="Small switch"
                  />
                  <UI.Switch disabled aria-label="Disabled switch" />
                </div>
                <UI.Slider aria-label="Zoom" defaultValue={50} />
                <UI.Slider aria-label="Default slider" />
                <UI.Slider
                  aria-label="Selected range"
                  defaultValue={[20, 70]}
                />
                <div className="gallery-row">
                  <UI.Toggle aria-label="Bold">B</UI.Toggle>
                  <UI.ToggleGroup
                    type="single"
                    orientation="vertical"
                    spacing={2}
                    style={{
                      margin: 1,
                    }}
                    defaultValue="left"
                  >
                    <UI.ToggleGroupItem value="left" aria-label="Align left">
                      Left
                    </UI.ToggleGroupItem>
                    <UI.ToggleGroupItem
                      value="center"
                      aria-label="Align center"
                    >
                      Center
                    </UI.ToggleGroupItem>
                    <UI.ToggleGroupItem value="right" aria-label="Align right">
                      Right
                    </UI.ToggleGroupItem>
                  </UI.ToggleGroup>
                </div>
              </div>
            </div>
          </Section>
          <Menus />
          <Overlays />
          <Section
            title="Navigation and disclosure"
            components="accordion collapsible tabs breadcrumb navigation-menu pagination command"
          >
            <UI.Breadcrumb>
              <UI.BreadcrumbList>
                <UI.BreadcrumbItem>
                  <UI.BreadcrumbLink href="#workspace">
                    Workspace
                  </UI.BreadcrumbLink>
                </UI.BreadcrumbItem>
                <UI.BreadcrumbSeparator />
                <UI.BreadcrumbItem>
                  <UI.BreadcrumbPage>Notes</UI.BreadcrumbPage>
                </UI.BreadcrumbItem>
              </UI.BreadcrumbList>
            </UI.Breadcrumb>
            <UI.NavigationMenu>
              <UI.NavigationMenuList>
                <UI.NavigationMenuItem>
                  <UI.NavigationMenuTrigger>
                    Browse documents
                  </UI.NavigationMenuTrigger>
                  <UI.NavigationMenuContent>
                    <UI.NavigationMenuLink href="#recent">
                      Recent documents
                    </UI.NavigationMenuLink>
                    <UI.NavigationMenuLink href="#pinned">
                      Pinned documents
                    </UI.NavigationMenuLink>
                  </UI.NavigationMenuContent>
                </UI.NavigationMenuItem>
              </UI.NavigationMenuList>
            </UI.NavigationMenu>
            <UI.Tabs defaultValue="editor">
              <UI.TabsList>
                <UI.TabsTrigger value="editor">Editor tab</UI.TabsTrigger>
                <UI.TabsTrigger value="preview">Preview tab</UI.TabsTrigger>
              </UI.TabsList>
              <UI.TabsContent value="editor">Edit your document</UI.TabsContent>
              <UI.TabsContent value="preview">
                Preview your document
              </UI.TabsContent>
            </UI.Tabs>
            <UI.Tabs orientation="vertical" defaultValue="general">
              <UI.TabsList variant="line">
                <UI.TabsTrigger value="general">General</UI.TabsTrigger>
                <UI.TabsTrigger value="advanced">Advanced</UI.TabsTrigger>
              </UI.TabsList>
              <UI.TabsContent value="general">General settings</UI.TabsContent>
              <UI.TabsContent value="advanced">
                Advanced settings
              </UI.TabsContent>
            </UI.Tabs>
            <UI.Accordion>
              <UI.AccordionItem value="details">
                <UI.AccordionTrigger>Document details</UI.AccordionTrigger>
                <UI.AccordionContent>
                  Created September 7, 2026.
                </UI.AccordionContent>
              </UI.AccordionItem>
              <UI.AccordionItem value="history">
                <UI.AccordionTrigger>Version history</UI.AccordionTrigger>
                <UI.AccordionContent>No previous versions.</UI.AccordionContent>
              </UI.AccordionItem>
            </UI.Accordion>
            <UI.Collapsible>
              <UI.CollapsibleTrigger render={<UI.Button variant="ghost" />}>
                Show metadata
              </UI.CollapsibleTrigger>
              <UI.CollapsibleContent>
                Last saved just now.
              </UI.CollapsibleContent>
            </UI.Collapsible>
            <UI.Pagination>
              <UI.PaginationContent>
                <UI.PaginationItem>
                  <UI.PaginationPrevious href="#previous" />
                </UI.PaginationItem>
                <UI.PaginationItem>
                  <UI.PaginationLink href="#1" isActive>
                    1
                  </UI.PaginationLink>
                </UI.PaginationItem>
                <UI.PaginationItem>
                  <UI.PaginationEllipsis />
                </UI.PaginationItem>
                <UI.PaginationItem>
                  <UI.PaginationNext href="#next" />
                </UI.PaginationItem>
              </UI.PaginationContent>
            </UI.Pagination>
            <UI.Command>
              <UI.CommandInput placeholder="Find a command" />
              <UI.CommandList>
                <UI.CommandEmpty>No commands found.</UI.CommandEmpty>
                <UI.CommandGroup heading="Documents">
                  <UI.CommandItem>
                    Open file<UI.CommandShortcut>⌘O</UI.CommandShortcut>
                  </UI.CommandItem>
                  <UI.CommandItem>Save file</UI.CommandItem>
                </UI.CommandGroup>
                <UI.CommandSeparator />
                <UI.CommandGroup heading="Workspace">
                  <UI.CommandItem>Settings</UI.CommandItem>
                </UI.CommandGroup>
              </UI.CommandList>
            </UI.Command>
          </Section>
          <Section
            title="Data and layout"
            components="calendar chart table card item avatar aspect-ratio carousel resizable scroll-area separator sidebar"
          >
            <div className="gallery-columns">
              <UI.Calendar
                mode="single"
                defaultMonth={date}
                selected={date}
                onSelect={setDate}
                today={new Date(2026, 8, 7)}
                captionLayout="dropdown"
                startMonth={new Date(2024, 2)}
                endMonth={new Date(2028, 9)}
              />
              <UI.ChartContainer
                className="gallery-chart"
                config={{
                  words: {
                    label: "Words",
                    color: "var(--chart-1)",
                  },
                }}
              >
                <BarChart
                  data={[
                    {
                      day: "Mon",
                      words: 240,
                    },
                    {
                      day: "Tue",
                      words: 400,
                    },
                    {
                      day: "Wed",
                      words: 0,
                    },
                  ]}
                  accessibilityLayer
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" />
                  <UI.ChartTooltip content={<UI.ChartTooltipContent />} />
                  <UI.ChartLegend content={<UI.ChartLegendContent />} />
                  <Bar
                    dataKey="words"
                    fill="var(--color-words)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </UI.ChartContainer>
            </div>
            <UI.Table>
              <UI.TableCaption>Recent documents</UI.TableCaption>
              <UI.TableHeader>
                <UI.TableRow>
                  <UI.TableHead>Name</UI.TableHead>
                  <UI.TableHead>Words</UI.TableHead>
                  <UI.TableHead>Status</UI.TableHead>
                </UI.TableRow>
              </UI.TableHeader>
              <UI.TableBody>
                <UI.TableRow>
                  <UI.TableCell>Notes.md</UI.TableCell>
                  <UI.TableCell>240</UI.TableCell>
                  <UI.TableCell>Saved</UI.TableCell>
                </UI.TableRow>
                <UI.TableRow data-state="selected">
                  <UI.TableCell>Draft.md</UI.TableCell>
                  <UI.TableCell>120</UI.TableCell>
                  <UI.TableCell>Editing</UI.TableCell>
                </UI.TableRow>
              </UI.TableBody>
              <UI.TableFooter>
                <UI.TableRow>
                  <UI.TableCell>Total</UI.TableCell>
                  <UI.TableCell colSpan={2}>360 words</UI.TableCell>
                </UI.TableRow>
              </UI.TableFooter>
            </UI.Table>
            <div className="gallery-columns">
              <UI.Card>
                <UI.CardHeader>
                  <UI.CardTitle>Workspace</UI.CardTitle>
                  <UI.CardDescription>Local documents</UI.CardDescription>
                  <UI.CardAction>
                    <UI.Badge>3 files</UI.Badge>
                  </UI.CardAction>
                </UI.CardHeader>
                <UI.CardContent>Choose a document to continue.</UI.CardContent>
                <UI.CardFooter>
                  <UI.Button variant="outline">Open workspace</UI.Button>
                </UI.CardFooter>
              </UI.Card>
              <UI.ItemGroup>
                <UI.Item>
                  <UI.ItemMedia>
                    <UI.Avatar>
                      <UI.AvatarFallback>MD</UI.AvatarFallback>
                      <UI.AvatarBadge />
                    </UI.Avatar>
                  </UI.ItemMedia>
                  <UI.ItemContent>
                    <UI.ItemTitle>Notes.md</UI.ItemTitle>
                    <UI.ItemDescription>Updated just now</UI.ItemDescription>
                  </UI.ItemContent>
                  <UI.ItemActions>
                    <UI.Button variant="ghost">Open</UI.Button>
                  </UI.ItemActions>
                </UI.Item>
                <UI.ItemSeparator />
                <UI.Item>
                  <UI.ItemContent>
                    <UI.ItemTitle>Draft.md</UI.ItemTitle>
                    <UI.ItemDescription>Updated yesterday</UI.ItemDescription>
                  </UI.ItemContent>
                </UI.Item>
              </UI.ItemGroup>
            </div>
            <div className="gallery-row">
              <UI.AvatarGroup>
                <UI.Avatar>
                  <UI.AvatarImage
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23888'/%3E%3C/svg%3E"
                    alt="Author"
                  />
                  <UI.AvatarFallback>A</UI.AvatarFallback>
                </UI.Avatar>
                <UI.Avatar>
                  <UI.AvatarFallback>B</UI.AvatarFallback>
                </UI.Avatar>
                <UI.AvatarGroupCount>+2</UI.AvatarGroupCount>
              </UI.AvatarGroup>
              <div className="gallery-aspect">
                <UI.AspectRatio
                  ratio={16 / 9}
                  style={{ color: "var(--foreground)" }}
                >
                  16:9 preview
                </UI.AspectRatio>
              </div>
            </div>
            <UI.Separator />
            <div className="gallery-carousel">
              <UI.Carousel>
                <UI.CarouselContent>
                  {[1, 2, 3].map((number) => (
                    <UI.CarouselItem key={number}>
                      <div className="gallery-carousel-slide">
                        Document {number}
                      </div>
                    </UI.CarouselItem>
                  ))}
                </UI.CarouselContent>
                <UI.CarouselPrevious />
                <UI.CarouselNext />
              </UI.Carousel>
            </div>
            <div className="gallery-resizable">
              <UI.ResizablePanelGroup orientation="horizontal">
                <UI.ResizablePanel defaultSize="50%">
                  <p>Editor pane</p>
                </UI.ResizablePanel>
                <UI.ResizableHandle withHandle />
                <UI.ResizablePanel defaultSize="50%">
                  <p>Preview pane</p>
                </UI.ResizablePanel>
              </UI.ResizablePanelGroup>
            </div>
            <UI.ScrollArea
              className="gallery-scroll"
              data-testid="scroll-area-vertical"
            >
              {Array.from(
                {
                  length: 12,
                },
                (_, index) => (
                  <p key={index}>Document {index + 1}</p>
                ),
              )}
            </UI.ScrollArea>
            <UI.ScrollArea
              className="gallery-scroll"
              data-testid="scroll-area-horizontal"
            >
              <div
                style={{
                  width: 1400,
                  padding: 16,
                }}
              >
                A wide document with horizontal scrolling
              </div>
              <UI.ScrollBar orientation="horizontal" />
            </UI.ScrollArea>
            <div
              className="gallery-scroll"
              style={{
                overflow: "auto",
                background: "var(--muted)",
              }}
              data-testid="native-scroll"
            >
              <div
                style={{
                  width: 1400,
                }}
              >
                {Array.from(
                  {
                    length: 12,
                  },
                  (_, index) => (
                    <p key={index}>Native overflow {index + 1}</p>
                  ),
                )}
              </div>
            </div>
            <div className="gallery-sidebar">
              <UI.SidebarProvider>
                <UI.Sidebar collapsible="none">
                  <UI.SidebarHeader>
                    <UI.SidebarInput
                      aria-label="Search sidebar"
                      placeholder="Search files"
                    />
                  </UI.SidebarHeader>
                  <UI.SidebarContent>
                    <UI.SidebarGroup>
                      <UI.SidebarGroupLabel>Documents</UI.SidebarGroupLabel>
                      <UI.SidebarGroupContent>
                        <UI.SidebarMenu>
                          <UI.SidebarMenuItem>
                            <UI.SidebarMenuButton isActive>
                              <span>Notes.md</span>
                            </UI.SidebarMenuButton>
                            <UI.SidebarMenuBadge>24</UI.SidebarMenuBadge>
                          </UI.SidebarMenuItem>
                          <UI.SidebarMenuItem>
                            <UI.SidebarMenuButton>
                              <span>Draft.md</span>
                            </UI.SidebarMenuButton>
                            <UI.SidebarMenuSub>
                              <UI.SidebarMenuSubItem>
                                <UI.SidebarMenuSubButton href="#draft">
                                  <span>Outline</span>
                                </UI.SidebarMenuSubButton>
                              </UI.SidebarMenuSubItem>
                            </UI.SidebarMenuSub>
                          </UI.SidebarMenuItem>
                        </UI.SidebarMenu>
                      </UI.SidebarGroupContent>
                    </UI.SidebarGroup>
                  </UI.SidebarContent>
                  <UI.SidebarSeparator />
                  <UI.SidebarFooter>Local workspace</UI.SidebarFooter>
                </UI.Sidebar>
                <UI.SidebarInset>
                  <p>Document content</p>
                </UI.SidebarInset>
              </UI.SidebarProvider>
            </div>
          </Section>
          <Section
            title="Status and feedback"
            components="alert badge empty kbd progress skeleton toast spinner"
          >
            <div className="gallery-row">
              {["default", "secondary", "outline", "destructive"].map(
                (variant) => (
                  <UI.Badge key={variant} variant={variant}>
                    {variant}
                  </UI.Badge>
                ),
              )}
              <UI.KbdGroup>
                <UI.Kbd>⌘</UI.Kbd>
                <UI.Kbd>S</UI.Kbd>
              </UI.KbdGroup>
              <UI.Spinner aria-label="Loading documents" />
            </div>
            <div className="gallery-row" data-testid="shape-examples">
              <span
                className="size-4 shrink-0 rounded-full bg-primary"
                data-testid="status-light"
                aria-label="Active indicator"
              />
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                data-slot="level-indicator"
                data-testid="level-indicator"
              >
                2
              </span>
              <span
                className="size-8 rounded-full bg-primary before:block before:size-4 before:rounded-full before:bg-background"
                data-slot="circle-with-pseudo"
                data-testid="circle-with-pseudo"
              />
              <span
                className="size-8 rounded-md bg-primary"
                data-testid="app-surface"
              />
            </div>
            <UI.Alert>
              <UI.AlertTitle>All changes saved</UI.AlertTitle>
              <UI.AlertDescription>
                Your document is up to date.
              </UI.AlertDescription>
              <UI.AlertAction>
                <UI.Button variant="ghost" size="sm">
                  Dismiss
                </UI.Button>
              </UI.AlertAction>
            </UI.Alert>
            <UI.Alert variant="destructive">
              <UI.AlertTitle>Unable to save</UI.AlertTitle>
              <UI.AlertDescription>
                Choose another location.
              </UI.AlertDescription>
            </UI.Alert>
            <UI.Progress value={60} max={200} aria-label="Import progress" />
            <UI.Progress value={null} aria-label="Loading progress" />
            <UI.Skeleton
              style={{
                height: 20,
                width: "60%",
              }}
            />
            <UI.Empty>
              <UI.EmptyHeader>
                <UI.EmptyMedia variant="icon">+</UI.EmptyMedia>
                <UI.EmptyTitle>No documents</UI.EmptyTitle>
                <UI.EmptyDescription>
                  Create your first document.
                </UI.EmptyDescription>
              </UI.EmptyHeader>
              <UI.EmptyContent>
                <UI.Button>New document</UI.Button>
              </UI.EmptyContent>
            </UI.Empty>
            <div>
              <UI.Button
                variant="outline"
                onClick={() =>
                  toast.add({
                    title: "Document saved",
                    type: "success",
                    description: "All changes are up to date.",
                    timeout: 60000,
                  })
                }
              >
                Show notification
              </UI.Button>
            </div>
          </Section>
          <InteractionGallery />
          <TypesetGallery />
          <AiGallery />
          <ScrollbarGallery />
        </main>
        <UI.Toaster />
      </UI.TooltipProvider>
    </UI.DirectionProvider>
  );
}
createRoot(document.getElementById("root")).render(<Gallery />);
