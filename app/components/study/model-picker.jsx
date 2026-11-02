import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createFuzzyFilter } from "@/lib/fuzzy-search";
import { useModelCatalog } from "@/hooks/use-model-catalog";

// Preserve the server edition's searchable model + supported-effort controls.
// The owner settings service is the canonical preference; never silently reset it.
export function ModelPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}) {
  const { models, loading, error, refresh } = useModelCatalog();
  const modelsById = React.useMemo(
    () => new Map(models.map((item) => [item.id, item])),
    [models],
  );
  const selected = modelsById.get(value.model);
  const variants = selected?.variants || [];
  const showDefaultEffort = !selected?.defaultVariant || !value.reasoningEffort;
  const unavailableEffort =
    value.reasoningEffort &&
    selected &&
    !variants.includes(value.reasoningEffort);
  const ids = React.useMemo(() => models.map((item) => item.id), [models]);
  const filter = React.useMemo(
    () =>
      createFuzzyFilter(ids, (id) => {
        const model = modelsById.get(id);
        return `${model?.name || ""} ${id}`;
      }),
    [ids, modelsById],
  );
  const controls = (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Combobox
          items={ids}
          filter={filter}
          value={value.model}
          itemToStringLabel={(id) => modelsById.get(id)?.name || id}
          onValueChange={(id) => {
            if (id === value.model) {
              return;
            }
            const model = modelsById.get(id);
            if (model) {
              onChange({
                model: model.id,
                reasoningEffort: model.variants.includes(value.reasoningEffort)
                  ? value.reasoningEffort
                  : model.defaultVariant || "",
              });
            }
          }}
          disabled={disabled || loading || Boolean(error)}
        >
          <ComboboxTrigger aria-label="Model" className="min-w-0 max-w-full">
            <span className="truncate">{selected?.name || value.model}</span>
          </ComboboxTrigger>
          <ComboboxContent className="min-w-[min(20rem,var(--available-width))]">
            <ComboboxInput
              aria-label="Search models"
              placeholder="Search models…"
              showTrigger={false}
            />
            <ComboboxEmpty>No models found</ComboboxEmpty>
            <ComboboxList>
              {(id) => (
                <ComboboxItem key={id} value={id}>
                  {modelsById.get(id)?.name || id}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {variants.length > 0 && (
          <Select
            items={[
              ...(showDefaultEffort
                ? [{ value: "default", label: "Default effort" }]
                : []),
              ...variants.map((effort) => ({ value: effort, label: effort })),
            ]}
            value={value.reasoningEffort || "default"}
            disabled={disabled || loading}
            onValueChange={(effort) => {
              if (effort === "default" && showDefaultEffort) {
                onChange({ model: value.model, reasoningEffort: "" });
              } else if (variants.includes(effort)) {
                onChange({ model: value.model, reasoningEffort: effort });
              }
            }}
          >
            <SelectTrigger aria-label="Reasoning effort">
              <SelectValue
                placeholder={
                  unavailableEffort ? value.reasoningEffort : "Default effort"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {showDefaultEffort && (
                <SelectItem value="default">Default effort</SelectItem>
              )}
              {variants.map((effort) => (
                <SelectItem key={effort} value={effort}>
                  {effort}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {error ? (
        <div className="flex items-center gap-2">
          <p role="alert" className="text-body-sm text-destructive">
            Models unavailable
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={disabled || loading}
          >
            Retry
          </Button>
        </div>
      ) : !loading && (!selected || unavailableEffort) ? (
        <p role="alert" className="text-body-sm text-destructive">
          {!selected
            ? "Choose an available model."
            : "Choose an available reasoning effort."}
        </p>
      ) : null}
    </div>
  );
  if (!compact) {
    return controls;
  }
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" disabled={disabled} />}
        aria-label="Change generation model"
        className="h-auto min-h-9 max-w-full justify-start py-2 text-left"
        title={`${selected?.name || value.model} · ${value.reasoningEffort || "Default effort"}`}
      >
        <span className="min-w-0">
          <span className="block truncate">
            {selected?.name || value.model}
          </span>
          <span className="block text-body-sm text-muted-foreground">
            {value.reasoningEffort || "Default effort"}
          </span>
        </span>
        {error && (
          <span
            aria-label="Models unavailable"
            className="size-1.5 shrink-0 rounded-full bg-destructive"
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96">
        <PopoverHeader>
          <PopoverTitle>Generation model</PopoverTitle>
        </PopoverHeader>
        {controls}
      </PopoverContent>
    </Popover>
  );
}
