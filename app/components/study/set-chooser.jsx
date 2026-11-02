import { useCapabilities } from "@/lib/runtime-client";
import { initializeStoredStudyFavorites } from "@/lib/study-favorites";
import { createFuzzySearch } from "@/lib/fuzzy-search";
import * as React from "react";
import { useStudyLibraryActions } from "@/hooks/use-study-library-actions";
import { useNavigate } from "react-router";
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
import { ButtonLink } from "@/components/button-link";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { SearchIcon } from "@primer/octicons-react";
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
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StudyFullscreenControl } from "@/components/study/study-fullscreen-control";
import { useAppUpdate } from "@/lib/app-update";
import { APP_VERSION } from "@/lib/app-config";
import { getSetCategoryPath, selectLocalStudySets } from "@/lib/study-sets";
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button variant="ghost" onClick={handleRefresh}>
            Okay
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SetChooser({ activeSlug, onOpenChange }) {
  const capabilities = useCapabilities();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const appUpdate = useAppUpdate();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const records = useStudySetsStore((state) => state.records);
  const storageStatus = useStudySetsStore((state) => state.status);
  const storageError = useStudySetsStore((state) => state.error);
  const { deleteSet: handleDeleteSet, resetSet: handleResetSet } =
    useStudyLibraryActions(activeSlug);
  const sets = React.useMemo(() => selectLocalStudySets(records), [records]);
  const favoriteItems = useStudyFavoritesStore((state) => state.favorites);
  const addFavorite = useStudyFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useStudyFavoritesStore(
    (state) => state.removeFavorite,
  );
  const interactionsBySet = useStudyInteractionsStore(
    (state) => state.interactionsBySet,
  );
  useLoadStudySets();
  React.useEffect(() => {
    if (capabilities && !capabilities.server && storageStatus === "ready") {
      useStudyFavoritesStore
        .getState()
        .setFavorites(initializeStoredStudyFavorites(sets));
    }
  }, [capabilities, sets, storageStatus]);
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
    if (!nextOpen) {
      setQuery("");
    }
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

  const searchSets = React.useMemo(
    () =>
      createFuzzySearch(
        sets,
        (set) => `${set.title} ${getSetCategoryPath(set)}`,
      ),
    [sets],
  );
  const visibleSets = searchSets(query);
  const search = query.trim();
  const panelContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-4 pb-4">
        <nav
          aria-label="Workspace"
          className={`flex items-center gap-1 ${activeSlug ? "" : "md:hidden"}`}
        >
          <ButtonLink variant="ghost" size="sm" to="/" onClick={closePanel}>
            Library
          </ButtonLink>
        </nav>
        {updateAvailable && (
          <AppUpdateNotice
            refreshSupported={appUpdate.refreshSupported}
            onRefresh={appUpdate.refresh}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <StudySetImportDropzone
            variant="compact"
            onImported={handleImported}
          />
          <GenerateCardsButton size="sm" onClick={closePanel} />
        </div>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search study sets"
            placeholder="Search study sets…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
        {storageError && (
          <p role="alert" className="pb-3 text-body-sm text-destructive">
            {storageError}
          </p>
        )}
        {storageStatus === "loading" && (
          <p role="status" className="py-3 text-body-sm text-muted-foreground">
            Loading sets…
          </p>
        )}
        {visibleSets.length ? (
          <SetBrowserTree
            sets={visibleSets}
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
        ) : (
          storageStatus !== "loading" && (
            <Empty className="min-h-40 px-2 py-8">
              <EmptyHeader>
                <EmptyTitle>
                  {search ? "No matching sets" : "No study sets yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {search
                    ? "Try a different title or category."
                    : "Generate cards or import a set to begin."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        )}
      </div>
    </div>
  );
  const versionLabel = (
    <p className="text-center text-body-sm text-muted-foreground">
      Version {APP_VERSION}
    </p>
  );
  const settingsControls = (
    <div className="flex w-full items-center justify-between gap-2">
      <ButtonLink variant="ghost" size="sm" to="/settings" onClick={closePanel}>
        Settings
      </ButtonLink>
      <StudyFullscreenControl onToggleComplete={closePanel} />
      <ThemeModeSwitcher />
    </div>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={setPanelOpen}
      swipeDirection={isMobile ? "down" : "right"}
    >
      <DrawerTrigger render={trigger} />
      <DrawerContent
        className={isMobile ? "max-h-[85dvh]" : undefined}
        viewportClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <DrawerHeader className="text-left">
          <DrawerTitle>Study sets</DrawerTitle>
          <DrawerDescription className="sr-only">
            {chooserDescription}
          </DrawerDescription>
        </DrawerHeader>
        {panelContent}
        <DrawerFooter className="gap-3 border-t">
          {settingsControls}
          {versionLabel}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
