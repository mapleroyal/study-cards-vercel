import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  performLibraryAction,
  undoLibraryAction,
} from "@/lib/runtime-study-set-storage";
import {
  flushRuntimeSync,
  refreshRuntimeState,
  getRuntimeSyncSnapshot,
} from "@/lib/runtime-sync";
import { downloadStudySet } from "@/lib/study-set-export";
import { validateStudySetImport } from "@/lib/study-set-validation";
import { useStudySetsStore } from "@/stores/use-study-sets-store";

async function flushBeforeEdit() {
  await flushRuntimeSync();
  if (getRuntimeSyncSnapshot().pending) {
    throw new Error("Reconnect to save changes.");
  }
}
async function savePatch(record, patch, label) {
  await flushBeforeEdit();
  const result = await performLibraryAction(
    "study_set.update",
    { id: record.id, patch },
    { expectedRevision: record.revision },
  );
  await refreshRuntimeState();
  toast.success(label, {
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await flushBeforeEdit();
          await undoLibraryAction(result.mutationId);
          await refreshRuntimeState();
        } catch (error) {
          toast.error(error.message);
        }
      },
    },
  });
}
function useRecord(slug) {
  return useStudySetsStore((state) =>
    state.records.find((record) => record.slug === slug),
  );
}

export function SetEditMenu({ set }) {
  const record = useRecord(set.slug);
  const records = useStudySetsStore((state) => state.records);
  const [mode, setMode] = React.useState(null);
  const [snapshot, setSnapshot] = React.useState(null);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const categories = [
    ...new Set(records.map((item) => item.rawSet.category)),
  ].sort();
  if (!record?.id) {
    return null;
  }
  function open(next) {
    setSnapshot(record);
    setValue(next === "rename" ? record.rawSet.title : record.rawSet.category);
    setError(null);
    setMode(next);
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await savePatch(
        snapshot,
        mode === "rename"
          ? { title: value.trim() }
          : { category: value.trim() },
        mode === "rename" ? "Set renamed" : "Set moved",
      );
      setMode(null);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Edit ${set.title}`}
            />
          }
        >
          •••
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => open("rename")}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => open("move")}>Move</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              try {
                downloadStudySet(record);
              } catch (cause) {
                toast.error(cause.message || "Could not export this set.");
              }
            }}
          >
            Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={Boolean(mode)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busy) {
            setMode(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "rename" ? "Rename set" : "Move set"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <Label htmlFor={`set-edit-${set.slug}`}>
              {mode === "rename" ? "Title" : "Category"}
            </Label>
            {mode === "rename" ? (
              <Input
                id={`set-edit-${set.slug}`}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
                autoFocus
              />
            ) : (
              <Combobox
                items={categories}
                value={value}
                inputValue={value}
                onInputValueChange={setValue}
                onValueChange={(next) => {
                  if (next) {
                    setValue(next);
                  }
                }}
              >
                <ComboboxInput
                  id={`set-edit-${set.slug}`}
                  placeholder="Choose or enter a category"
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {value ? `Use “${value}”` : "Enter a category"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            )}
            {error && (
              <p role="alert" className="text-body-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <Button disabled={busy || !value.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StringRows({ label, values, onChange, reorder = false }) {
  function move(index, delta) {
    const next = [...values];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label-lg">{label}</legend>
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-1">
          <Input
            aria-label={`${label} ${index + 1}`}
            value={value}
            onChange={(event) =>
              onChange(
                values.map((item, i) =>
                  i === index ? event.target.value : item,
                ),
                { kind: "edit", index },
              )
            }
            required
          />
          {reorder && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move item ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move item ${index + 1} down`}
                disabled={index === values.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            disabled={values.length <= 1}
            onClick={() =>
              onChange(
                values.filter((_, i) => i !== index),
                { kind: "remove", index },
              )
            }
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onChange([...values, ""], { kind: "add" })}
      >
        Add
      </Button>
    </fieldset>
  );
}

function CardAnswerFields({ draft, setDraft }) {
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  if (draft.type === "true_false") {
    return (
      <div className="flex flex-col gap-2">
        <Label>Answer</Label>
        <Select
          items={[
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]}
          value={String(draft.answer)}
          onValueChange={(value) =>
            value !== null && update({ answer: value === "true" })
          }
        >
          <SelectTrigger aria-label="Answer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (draft.type === "short_answer") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="card-answer">Answer</Label>
        <Textarea
          id="card-answer"
          value={draft.answer}
          onChange={(event) => update({ answer: event.target.value })}
          required
        />
      </div>
    );
  }
  if (draft.type === "fill_in_the_blank") {
    return (
      <StringRows
        label="Answers"
        values={draft.answer}
        onChange={(answer) => update({ answer })}
      />
    );
  }
  if (draft.type === "ordering") {
    return (
      <StringRows
        label="Correct order"
        values={draft.answer}
        onChange={(answer) => update({ answer, unordered_items: [...answer] })}
        reorder
      />
    );
  }
  if (["multiple_choice", "multiple_response"].includes(draft.type)) {
    const multiple = draft.type === "multiple_response";
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg">Options</legend>
        {Object.entries(draft.options).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              aria-label={`Correct answer ${key}`}
              checked={
                multiple ? draft.answer.includes(key) : draft.answer === key
              }
              onCheckedChange={(checked) =>
                update({
                  answer: multiple
                    ? checked
                      ? [...draft.answer, key]
                      : draft.answer.filter((item) => item !== key)
                    : checked
                      ? key
                      : draft.answer,
                })
              }
            />
            <span className="text-label-md">{key}</span>
            <Input
              aria-label={`Option ${key}`}
              value={value}
              onChange={(event) =>
                update({
                  options: { ...draft.options, [key]: event.target.value },
                })
              }
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove option ${key}`}
              disabled={Object.keys(draft.options).length <= 1}
              onClick={() => {
                const options = { ...draft.options };
                delete options[key];
                update({
                  options,
                  answer: multiple
                    ? draft.answer.filter((item) => item !== key)
                    : draft.answer === key
                      ? Object.keys(options)[0]
                      : draft.answer,
                });
              }}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            let index = 0;
            let key;
            do {
              key =
                index < 26
                  ? String.fromCharCode(65 + index)
                  : String(index + 1);
              index++;
            } while (Object.hasOwn(draft.options, key));
            update({ options: { ...draft.options, [key]: "" } });
          }}
        >
          Add option
        </Button>
      </fieldset>
    );
  }
  if (draft.type === "matching") {
    return (
      <>
        <StringRows
          label="Prompts"
          values={draft.prompts}
          onChange={(prompts, change) =>
            update({
              prompts,
              answer: prompts.map((prompt, index) => {
                const oldIndex =
                  change.kind === "remove" && index >= change.index
                    ? index + 1
                    : index;
                return {
                  prompt,
                  choices:
                    draft.answer.find(
                      (item) => item.prompt === draft.prompts[oldIndex],
                    )?.choices || [],
                };
              }),
            })
          }
        />
        <StringRows
          label="Choices"
          values={draft.choices}
          onChange={(choices, change) =>
            update({
              choices,
              answer: draft.answer.map((item) => ({
                ...item,
                choices: item.choices.flatMap((choice) => {
                  const oldIndex = draft.choices.indexOf(choice);
                  if (change.kind === "remove" && oldIndex === change.index) {
                    return [];
                  }
                  const nextIndex =
                    change.kind === "remove" && oldIndex > change.index
                      ? oldIndex - 1
                      : oldIndex;
                  return choices[nextIndex] === undefined
                    ? []
                    : [choices[nextIndex]];
                }),
              })),
            })
          }
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label-lg">Matches</legend>
          {draft.prompts.map((prompt, index) => (
            <div key={index} className="flex flex-col gap-2">
              <p className="text-label-lg">{prompt || `Prompt ${index + 1}`}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {draft.choices.map((choice, choiceIndex) => (
                  <Label key={choiceIndex} className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        draft.answer
                          .find((item) => item.prompt === prompt)
                          ?.choices.includes(choice) || false
                      }
                      onCheckedChange={(checked) =>
                        update({
                          answer: draft.prompts.map((item) => ({
                            prompt: item,
                            choices:
                              item === prompt
                                ? checked
                                  ? [
                                      ...(draft.answer.find(
                                        (answer) => answer.prompt === item,
                                      )?.choices || []),
                                      choice,
                                    ]
                                  : (
                                      draft.answer.find(
                                        (answer) => answer.prompt === item,
                                      )?.choices || []
                                    ).filter((value) => value !== choice)
                                : (
                                    draft.answer.find(
                                      (answer) => answer.prompt === item,
                                    )?.choices || []
                                  ).filter(
                                    (value) => !checked || value !== choice,
                                  ),
                          })),
                        })
                      }
                    />
                    {choice || `Choice ${choiceIndex + 1}`}
                  </Label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      </>
    );
  }
  return null;
}

export function CardEditControl({ card, setSlug }) {
  const record = useRecord(setSlug);
  const [open, setOpen] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  if (!record?.id) {
    return null;
  }
  function begin() {
    setSnapshot(record);
    setDraft(
      globalThis.structuredClone(
        record.rawSet.cards.find((item) => item.id === card.id),
      ),
    );
    setError(null);
    setOpen(true);
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      validateStudySetImport({
        ...snapshot.rawSet,
        cards: snapshot.rawSet.cards.map((item) =>
          item.id === draft.id ? draft : item,
        ),
      });
      await savePatch(snapshot, { upsertCards: [draft] }, "Card updated");
      setOpen(false);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Edit card ${card.id}`}
        onClick={begin}
      >
        Edit
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
          </DialogHeader>
          {draft && (
            <form onSubmit={save} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="card-question">Question</Label>
                <Textarea
                  id="card-question"
                  value={draft.question}
                  onChange={(event) =>
                    setDraft({ ...draft, question: event.target.value })
                  }
                  required
                />
              </div>
              <CardAnswerFields draft={draft} setDraft={setDraft} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="card-explanation">Explanation</Label>
                <Textarea
                  id="card-explanation"
                  value={draft.explanation}
                  onChange={(event) =>
                    setDraft({ ...draft, explanation: event.target.value })
                  }
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-body-sm text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
