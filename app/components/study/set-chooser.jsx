import * as React from "react";
import {
  flushRuntimeSync,
  refreshRuntimeState,
  getRuntimeSyncSnapshot,
} from "@/lib/runtime-sync";
import { toast } from "sonner";
import { useCapabilities } from "@/lib/runtime-client";
import {
  getLatestMutationId,
  performLibraryAction,
  undoLibraryAction,
} from "@/lib/runtime-study-set-storage";
import { Link, useNavigate } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SidebarBottomIcon,
  SidebarRightIcon,
} from "@hugeicons/core-free-icons";

import { GenerateCardsButton } from "@/components/study/generate-cards-button";
import { SetBrowserTree } from "@/components/study/set-browser-tree";
import { StudySetImportDropzone } from "@/components/study/study-set-import-dropzone";
import { ThemeModeSwitcher } from "@/components/theme/theme-mode-switcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StudyFullscreenControl } from "@/components/study/study-fullscreen-control";
import { useAppUpdate } from "@/lib/app-update";
import { APP_VERSION } from "@/lib/app-config";
import { initializeStoredStudyFavorites } from "@/lib/study-favorites";
import { selectFirstLocalSet, selectLocalStudySets } from "@/lib/study-sets";
import {
  hasDirtyStudyInteractions,
  useStudyInteractionsStore,
} from "@/stores/use-study-interactions-store";
import { useStudyFavoritesStore } from "@/stores/use-study-favorites-store";
import {
  useLoadStudySets,
  useStudySetsStore,
} from "@/stores/use-study-sets-store";

const chooserDescription = "Choose, import, edit, or delete study sets.";

function AppUpdateNotice({ refreshSupported, onRefresh }) {
  const [open, setOpen] = React.useState(false);

  function handleRefresh() {
    if (refreshSupported) {
      onRefresh();
      return;
    }

    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex w-full rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <span className="relative block min-w-0 pl-3">
              <span
                className="absolute top-0 left-0 size-2 rounded-full bg-emerald-500"
                data-corner-shape="round"
                aria-hidden="true"
              />
              <span className="block text-label-lg text-foreground">
                Update available
              </span>
            </span>
          </button>
        }
      />
      <PopoverContent align="start" className="w-fit min-w-0 gap-3">
        <PopoverHeader>
          <PopoverTitle>
            {refreshSupported ? "Update now?" : "Reopen to update?"}
          </PopoverTitle>
        </PopoverHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button onClick={handleRefresh}>Okay</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SetChooser({ activeSlug, onOpenChange }) {
  const capabilities = useCapabilities();
  const [open, setOpen] = React.useState(false);
  const appUpdate = useAppUpdate();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const records = useStudySetsStore((state) => state.records);
  const storageStatus = useStudySetsStore((state) => state.status);
  const storageError = useStudySetsStore((state) => state.error);
  const deleteStudySet = useStudySetsStore((state) => state.deleteStudySet);
  const sets = React.useMemo(() => selectLocalStudySets(records), [records]);
  const favoriteItems = useStudyFavoritesStore((state) => state.favorites);
  const setFavorites = useStudyFavoritesStore((state) => state.setFavorites);
  const addFavorite = useStudyFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useStudyFavoritesStore(
    (state) => state.removeFavorite,
  );
  const resetSet = useStudyInteractionsStore((state) => state.resetSet);
  const interactionsBySet = useStudyInteractionsStore(
    (state) => state.interactionsBySet,
  );
  useLoadStudySets();
  React.useEffect(() => {
    if (capabilities && !capabilities.server && storageStatus === "ready") {
      setFavorites(initializeStoredStudyFavorites(sets));
    }
  }, [capabilities, setFavorites, sets, storageStatus]);
  const resettableSetSlugs = React.useMemo(
    () =>
      new Set(
        sets
          .filter((set) =>
            hasDirtyStudyInteractions(set.cards, interactionsBySet[set.slug]),
          )
          .map((set) => set.slug),
      ),
    [interactionsBySet, sets],
  );
  const deletableSetSlugs = React.useMemo(
    () =>
      new Set(
        sets
          .filter((set) => set.source?.type !== "bundled")
          .map((set) => set.slug),
      ),
    [sets],
  );
  const updateAvailable = appUpdate.updateAvailable;
  const hasMenuAttention = Boolean(updateAvailable);

  function setPanelOpen(nextOpen) {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function handleSelect(slug) {
    setPanelOpen(false);
    navigate(`/sets/${slug}`);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  function handleImported(record) {
    setPanelOpen(false);
    navigate(`/sets/${record.slug}`);
  }

  async function handleDeleteSet(slug) {
    let nextRecords;
    try {
      nextRecords = await deleteStudySet(slug);
    } catch (error) {
      toast.error(error.message);
      return;
    }
    if (capabilities?.server) {
      const mutationId = getLatestMutationId();
      toast.success("Set deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await undoLibraryAction(mutationId);
              await useStudySetsStore.getState().load();
            } catch (error) {
              toast.error(error.message);
            }
          },
        },
      });
    }

    if (activeSlug === slug) {
      const nextSet = selectFirstLocalSet(nextRecords);

      navigate(nextSet ? `/sets/${nextSet.slug}` : "/");
    }
  }

  async function handleResetSet(slug) {
    if (!capabilities?.server) {
      resetSet(slug);
      return;
    }
    try {
      await flushRuntimeSync();
      if (getRuntimeSyncSnapshot().pending) {
        throw new Error("Reconnect to reset progress.");
      }
      const result = await performLibraryAction("progress.reset", { slug });
      await refreshRuntimeState();
      toast.success("Progress reset", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await flushRuntimeSync();
              if (getRuntimeSyncSnapshot().pending) {
                throw new Error("Reconnect to undo this change.");
              }
              await undoLibraryAction(result.mutationId);
              await refreshRuntimeState();
            } catch (error) {
              toast.error(error.message);
            }
          },
        },
      });
    } catch (error) {
      toast.error(error.message);
    }
  }

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open study set menu"
      className="relative text-muted-foreground"
    >
      <HugeiconsIcon
        icon={isMobile ? SidebarBottomIcon : SidebarRightIcon}
        className="size-5"
      />
      {hasMenuAttention ? (
        <span
          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background"
          data-corner-shape="round"
          aria-hidden="true"
        />
      ) : null}
    </Button>
  );

  const list = (
    <div className="flex min-h-full flex-col gap-5 px-4 pb-4 pt-1">
      {updateAvailable ? (
        <AppUpdateNotice
          refreshSupported={appUpdate.refreshSupported}
          onRefresh={appUpdate.refresh}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <StudySetImportDropzone variant="compact" onImported={handleImported} />
        <GenerateCardsButton variant="outline" size="sm" onClick={closePanel} />
      </div>
      {storageError ? (
        <p className="px-1 text-body-sm text-destructive">{storageError}</p>
      ) : null}
      {storageStatus === "loading" ? (
        <p className="px-1 text-body-sm text-muted-foreground">
          Loading sets...
        </p>
      ) : null}
      <SetBrowserTree
        sets={sets}
        activeSlug={activeSlug}
        onSelect={handleSelect}
        resettableSetSlugs={resettableSetSlugs}
        onResetSet={handleResetSet}
        deletableSetSlugs={deletableSetSlugs}
        onDeleteSet={handleDeleteSet}
        favoriteItems={favoriteItems}
        onFavoriteItem={addFavorite}
        onUnfavoriteItem={removeFavorite}
      />
    </div>
  );

  const panelContent = (
    <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
  );
  const versionLabel = (
    <p className="text-center text-body-sm text-muted-foreground">
      Version {APP_VERSION}
    </p>
  );
  const settingsControls = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link to="/settings" onClick={closePanel}>
          Settings
        </Link>
      </Button>
      <StudyFullscreenControl onToggleComplete={closePanel} />
      <ThemeModeSwitcher />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setPanelOpen}>
        <DrawerTrigger render={trigger} />
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Study sets</DrawerTitle>
            <DrawerDescription className="sr-only">
              {chooserDescription}
            </DrawerDescription>
          </DrawerHeader>
          {panelContent}
          <DrawerFooter className="gap-3 border-t px-4 py-4">
            {settingsControls}
            {versionLabel}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setPanelOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent className="overflow-hidden">
        <SheetHeader>
          <SheetTitle>Study sets</SheetTitle>
          <SheetDescription className="sr-only">
            {chooserDescription}
          </SheetDescription>
        </SheetHeader>
        {panelContent}
        <SheetFooter className="gap-3 border-t px-4 py-4">
          {settingsControls}
          {versionLabel}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
