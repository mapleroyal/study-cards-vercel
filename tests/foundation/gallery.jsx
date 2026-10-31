import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import "./gallery.css";

// This fixture follows the browser project's system preference; it does not
// read or change the application's persisted user settings.
document.documentElement.classList.toggle(
  "dark",
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);

const formats = [
  { value: "markdown", label: "Markdown" },
  { value: "plain", label: "Plain text" },
  { value: "pdf", label: "PDF export" },
  {
    value: "long",
    label:
      "A very long document format name that should never escape the available space",
  },
];
const documents = Array.from({ length: 100 }, (_, index) => ({
  value: String(index),
  label: `Document ${String(index + 1).padStart(3, "0")}`,
}));

function Section({ title, children }) {
  return (
    <section className="foundation-section" aria-label={title}>
      <h2>{title}</h2>
      <div className="foundation-stack">{children}</div>
    </section>
  );
}

function FormatSelect({ grouped = false }) {
  const items = formats.map(({ value, label }) => (
    <SelectItem key={value} value={value} disabled={value === "pdf"}>
      {label}
    </SelectItem>
  ));
  return (
    <Select defaultValue="markdown" items={formats}>
      <SelectTrigger
        aria-label={grouped ? "Grouped format" : "Document format"}
        className="max-w-52"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {grouped ? (
          <SelectGroup>
            <SelectLabel>Formats</SelectLabel>
            {items}
          </SelectGroup>
        ) : (
          items
        )}
      </SelectContent>
    </Select>
  );
}

function NestedDialog() {
  const [action, setAction] = useState("None");
  const [date, setDate] = useState(new Date(2026, 5, 15));
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Edit document
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription>Document settings</DialogDescription>
        </DialogHeader>
        <Select defaultValue="plain" items={formats.slice(0, 2)}>
          <SelectTrigger aria-label="Document format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain">Plain text</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
          </SelectContent>
        </Select>
        <Combobox items={["Personal", "Work", "Finance"]}>
          <ComboboxInput aria-label="Document folder" />
          <ComboboxContent>
            <ComboboxEmpty>No folders</ComboboxEmpty>
            <ComboboxList>
              {(item) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            Choose document date
          </PopoverTrigger>
          <PopoverContent aria-label="Document date" className="w-auto p-0">
            <Calendar
              mode="single"
              defaultMonth={new Date(2026, 5, 15)}
              selected={date}
              onSelect={setDate}
              today={new Date(2026, 5, 15)}
              captionLayout="dropdown"
              startMonth={new Date(2024, 2)}
              endMonth={new Date(2028, 9)}
            />
          </PopoverContent>
        </Popover>
        <output aria-label="Selected document date">
          {date?.toLocaleDateString("en-US")}
        </output>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Draft actions
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setAction("Renamed")}>
              Rename draft
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("Archived")}>
              Archive draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <output aria-label="Draft action">{action}</output>
        <DialogFooter>
          <DialogClose render={<Button />}>Save changes</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmationPopover({ label }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="foundation-stack">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" />}>
          Confirm {label} choice
        </PopoverTrigger>
        <PopoverContent aria-label={`${label} confirmation`}>
          <Input aria-label={`${label} note`} placeholder="Optional note" />
          <Button
            onClick={() => {
              setConfirmed(true);
              setOpen(false);
            }}
          >
            Apply {label} choice
          </Button>
        </PopoverContent>
      </Popover>
      <output aria-label={`${label} result`}>
        {confirmed ? "Applied" : "Not applied"}
      </output>
    </div>
  );
}

function InterruptedGeneration({ panel }) {
  const [discarded, setDiscarded] = useState(false);
  return (
    <div className="foundation-stack">
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="outline" />}>
          Review interrupted generation
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard interrupted generation?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft is still available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep draft</AlertDialogCancel>
            <AlertDialogAction onClick={() => setDiscarded(true)}>
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <output aria-label={`${panel} interrupted generation`}>
        {discarded ? "Discarded" : "Draft retained"}
      </output>
    </div>
  );
}

function MixedPanels() {
  return (
    <div className="foundation-row">
      <Sheet>
        <SheetTrigger render={<Button variant="outline" />}>
          Open sheet
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet choices</SheetTitle>
            <SheetDescription>Review the choice.</SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <ConfirmationPopover label="sheet" />
            <InterruptedGeneration panel="sheet" />
          </div>
        </SheetContent>
      </Sheet>
      <Drawer>
        <DrawerTrigger render={<Button variant="outline" />}>
          Open drawer
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer choices</DrawerTitle>
            <DrawerDescription>Review the choice.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <ConfirmationPopover label="drawer" />
            <InterruptedGeneration panel="drawer" />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Gallery() {
  const [date, setDate] = useState(new Date(2026, 8, 7));
  return (
    <main className="foundation-gallery">
      <h1>Shared foundation verification</h1>
      <Section title="Corner treatment">
        <div className="foundation-row" data-testid="shape-examples">
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
            className="rounded-full bg-primary px-4 py-1 text-primary-foreground"
            data-testid="pill"
          >
            Round pill
          </span>
          <span
            className="size-8 rounded-md bg-primary"
            data-testid="app-surface"
          />
        </div>
      </Section>
      <Section title="Selection">
        <div className="foundation-row">
          <FormatSelect />
          <FormatSelect grouped />
        </div>
        <Select items={documents} defaultValue="0">
          <SelectTrigger aria-label="Many documents">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {documents.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>
      <Section title="Native reference">
        <NativeSelect aria-label="Native reference" defaultValue="markdown">
          <NativeSelectOption value="markdown">Markdown</NativeSelectOption>
          <NativeSelectOption value="plain">Plain text</NativeSelectOption>
        </NativeSelect>
      </Section>
      <Section title="Calendar navigation">
        <Calendar
          mode="single"
          defaultMonth={date}
          selected={date}
          onSelect={setDate}
          today={new Date(2026, 8, 7)}
          captionLayout="dropdown"
          startMonth={new Date(2024, 2)}
          endMonth={new Date(2028, 9)}
        />
      </Section>
      <Section title="Nested overlays">
        <div>
          <NestedDialog />
        </div>
      </Section>
      <Section title="Mixed overlay families">
        <MixedPanels />
      </Section>
      <Section title="Tab navigation">
        <Tabs defaultValue="editor">
          <TabsList aria-label="Document view">
            <TabsTrigger value="editor">Editor tab</TabsTrigger>
            <TabsTrigger value="preview">Preview tab</TabsTrigger>
          </TabsList>
          <TabsContent value="editor">Edit your document</TabsContent>
          <TabsContent value="preview">Preview your document</TabsContent>
        </Tabs>
        <Tabs orientation="vertical" defaultValue="general">
          <TabsList variant="line" aria-label="Settings section">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          <TabsContent value="general">General settings</TabsContent>
          <TabsContent value="advanced">Advanced settings</TabsContent>
        </Tabs>
      </Section>
      <Section title="Scrolling">
        <ScrollArea
          className="foundation-scroll"
          type="always"
          data-testid="scroll-area-vertical"
        >
          {Array.from({ length: 12 }, (_, index) => (
            <p key={index}>Document {index + 1}</p>
          ))}
        </ScrollArea>
        <ScrollArea
          className="foundation-scroll"
          type="always"
          data-testid="scroll-area-horizontal"
        >
          <div style={{ width: 1400, padding: 16 }}>
            A wide document with horizontal scrolling
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div
          className="foundation-scroll"
          style={{ overflow: "auto", background: "var(--muted)" }}
          data-testid="native-scroll"
        >
          <div style={{ width: 1400 }}>
            {Array.from({ length: 12 }, (_, index) => (
              <p key={index}>Native overflow {index + 1}</p>
            ))}
          </div>
        </div>
      </Section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Gallery />);
