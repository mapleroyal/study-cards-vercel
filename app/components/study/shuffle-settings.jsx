import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStudyReaderStore } from "@/stores/use-study-reader-store";

export function ShuffleSettings() {
  const id = React.useId();
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const enabled = useStudyReaderStore((state) => state.defaultShuffleEnabled);
  const setEnabled = useStudyReaderStore(
    (state) => state.setDefaultShuffleEnabled,
  );
  return (
    <section className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>Shuffle cards</Label>
        <p className="text-body-sm text-muted-foreground">
          Sets can use their own order.
        </p>
      </div>
      <Switch
        id={id}
        checked={hydrated ? enabled : true}
        onCheckedChange={setEnabled}
      />
    </section>
  );
}
