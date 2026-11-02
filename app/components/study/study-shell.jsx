import { SetEditMenu } from "@/components/study/study-edit-controls";
import {
  STUDY_APP_HEADER_HEIGHT,
  StudyAppHeader,
} from "@/components/study/study-app-header";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStudyLibraryActions } from "@/hooks/use-study-library-actions";
import {
  hasDirtyStudyInteractions,
  useStudyInteractionsStore,
} from "@/stores/use-study-interactions-store";
import {
  isShuffleEnabled,
  useStudyReaderStore,
} from "@/stores/use-study-reader-store";
import { getSetCategoryPath } from "@/lib/study-sets";
import { useScrollCollapseProgress } from "@/hooks/use-scroll-collapse-progress";
import * as React from "react";

export function StudyShell({ set, children }) {
  const [menuPanelOpen, setMenuPanelOpen] = React.useState(false);
  const shuffleId = React.useId();
  const { resetSet, deleteSet } = useStudyLibraryActions(set.slug);
  const interactions = useStudyInteractionsStore(
    (state) => state.interactionsBySet[set.slug],
  );
  const canReset = hasDirtyStudyInteractions(set.cards, interactions);
  const shuffleEnabled = useStudyReaderStore((state) =>
    isShuffleEnabled(state, set.slug),
  );
  const setShuffleEnabled = useStudyReaderStore(
    (state) => state.setShuffleEnabled,
  );
  const brandRowCollapseProgress = useScrollCollapseProgress({
    collapseDistance: STUDY_APP_HEADER_HEIGHT,
    paused: menuPanelOpen,
  });
  const categoryPath = getSetCategoryPath(set);
  const brandRowVisibility = 1 - brandRowCollapseProgress;
  const brandRowCollapseOffset =
    STUDY_APP_HEADER_HEIGHT * brandRowCollapseProgress;

  return (
    <div
      className="flex min-h-dvh w-full flex-col bg-background"
      style={{
        "--study-app-header-height": `${STUDY_APP_HEADER_HEIGHT}px`,
      }}
    >
      {/* Use transform, not height, so Chrome scroll anchoring stays stable. */}
      <div
        className="sticky top-0 z-40 w-full bg-background will-change-transform"
        style={{
          transform: `translate3d(0, -${brandRowCollapseOffset}px, 0)`,
        }}
      >
        <StudyAppHeader
          activeSlug={set.slug}
          onMenuOpenChange={setMenuPanelOpen}
          style={{
            opacity: brandRowVisibility,
          }}
        />

        <div className="border-b bg-background">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-1 px-4 pt-3 pb-5 sm:px-6">
            {categoryPath ? (
              <p className="max-w-full truncate text-body-sm text-muted-foreground">
                {categoryPath}
              </p>
            ) : null}
            <div className="flex w-full items-start justify-between gap-3">
              <h1 className="min-w-0 text-headline-md [overflow-wrap:anywhere]">
                {set.title}
              </h1>
              <SetEditMenu
                set={set}
                canReset={canReset}
                onReset={() => resetSet(set.slug)}
                canDelete={set.source?.type !== "bundled"}
                onDelete={() => deleteSet(set.slug)}
              />
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="shrink-0 text-body-sm text-muted-foreground type-numeric">
                {set.cards.length} {set.cards.length === 1 ? "card" : "cards"}
              </span>
              {set.cards.length > 1 ? (
                <div className="flex min-h-9 items-center gap-3">
                  <Label htmlFor={shuffleId}>Shuffle</Label>
                  <Switch
                    id={shuffleId}
                    aria-label="Shuffle questions"
                    checked={shuffleEnabled}
                    onCheckedChange={(enabled) =>
                      setShuffleEnabled(set.slug, enabled, set.cards)
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 sm:px-6">
        <div className="flex flex-1 flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
