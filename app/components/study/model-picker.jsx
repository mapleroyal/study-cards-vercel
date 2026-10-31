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
import { useModelCatalog } from "@/hooks/use-model-catalog";

// Preserve the server edition's searchable model + supported-effort controls.
// The owner settings service is the canonical preference; never silently reset it.
export function ModelPicker({ value, onChange, disabled = false }) {
  const { models, loading, error, refresh } = useModelCatalog();
  const selected = models.find((item) => item.id === value.model);
  const variants = selected?.variants || [];
  const showDefaultEffort = !selected?.defaultVariant || !value.reasoningEffort;
  const unavailableEffort =
    value.reasoningEffort &&
    selected &&
    !variants.includes(value.reasoningEffort);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Combobox
          items={models.map((item) => item.id)}
          value={value.model}
          itemToStringLabel={(id) =>
            models.find((item) => item.id === id)?.name || id
          }
          onValueChange={(id) => {
            if (id === value.model) {
              return;
            }
            const model = models.find((item) => item.id === id);
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
          <ComboboxTrigger
            aria-label="Model"
            render={
              <Button
                type="button"
                variant="secondary"
                className="min-w-0 max-w-64 gap-3"
              />
            }
          >
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
                  {models.find((item) => item.id === id)?.name || id}
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
}
