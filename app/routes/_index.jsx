import { activateStudyPacksFromUrl } from "@/lib/study-pack-activation";
import { createFuzzySearch } from "@/lib/fuzzy-search";
import * as React from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { GenerateCardsButton } from "@/components/study/generate-cards-button";
import { SetBrowserTree } from "@/components/study/set-browser-tree";
import {
  StudyAppHeader,
  STUDY_APP_HEADER_HEIGHT,
} from "@/components/study/study-app-header";
import { StudySetImportDropzone } from "@/components/study/study-set-import-dropzone";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { SearchIcon } from "@primer/octicons-react";
import { useStudyLibraryActions } from "@/hooks/use-study-library-actions";
import {
  hasDirtyStudyInteractions,
  useStudyInteractionsStore,
} from "@/stores/use-study-interactions-store";
import { formatPageTitle } from "@/lib/app-config";
import { listStudySetRecords } from "@/lib/runtime-study-set-storage";
import { getSetCategoryPath, selectLocalStudySets } from "@/lib/study-sets";
import { useStudyFavoritesStore } from "@/stores/use-study-favorites-store";
import {
  useHydrateStudySetsStore,
  useStudySetsStore,
} from "@/stores/use-study-sets-store";
export function meta() {
  return [{ title: formatPageTitle() }];
}
export async function clientLoader({ request }) {
  try {
    activateStudyPacksFromUrl(request.url);
    return { records: await listStudySetRecords(), storageError: null };
  } catch {
    return {
      records: useStudySetsStore.getState().records,
      storageError: "Study sets could not be loaded.",
    };
  }
}
export default function IndexRoute() {
  const loaderData = useLoaderData();
  const { records, storageError } = loaderData;
  const hydratedLoader = React.useRef(null);
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const { deleteSet, resetSet } = useStudyLibraryActions();
  const interactionsBySet = useStudyInteractionsStore(
    (state) => state.interactionsBySet,
  );
  const revalidator = useRevalidator();
  const storeRecords = useStudySetsStore((state) => state.records);
  const status = useStudySetsStore((state) => state.status);
  const storeError = useStudySetsStore((state) => state.error);
  const displayError =
    hydratedLoader.current === loaderData && status === "ready"
      ? storeError
      : storeError || storageError;
  const favoriteItems = useStudyFavoritesStore((state) => state.favorites);
  const addFavorite = useStudyFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useStudyFavoritesStore(
    (state) => state.removeFavorite,
  );
  const sets = React.useMemo(
    () => selectLocalStudySets(status === "ready" ? storeRecords : records),
    [status, storeRecords, records],
  );
  useHydrateStudySetsStore(records, storageError);
  React.useEffect(() => {
    hydratedLoader.current = loaderData;
  }, [loaderData]);
  const resettableSetSlugs = new Set(
    sets
      .filter((set) =>
        hasDirtyStudyInteractions(set.cards, interactionsBySet[set.slug]),
      )
      .map((set) => set.slug),
  );
  const deletableSetSlugs = new Set(
    sets.filter((set) => set.source?.type !== "bundled").map((set) => set.slug),
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
  const actions = (
    <>
      <StudySetImportDropzone
        variant="compact"
        onImported={(record) => navigate(`/sets/${record.slug}`)}
      />
      <GenerateCardsButton size="sm" />
    </>
  );
  return (
    <div
      className="flex min-h-dvh w-full flex-col bg-background"
      style={{ "--study-app-header-height": `${STUDY_APP_HEADER_HEIGHT}px` }}
    >
      <StudyAppHeader activeSlug={null} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-headline-lg">Study sets</h1>
          {sets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
        {displayError && (
          <div className="flex items-center gap-3" role="alert">
            <p className="text-body-sm text-destructive">{displayError}</p>
            <Button
              variant="ghost"
              onClick={() => revalidator.revalidate()}
              disabled={revalidator.state !== "idle"}
            >
              {revalidator.state === "idle" ? "Retry" : "Retrying…"}
            </Button>
          </div>
        )}
        {sets.length > 0 ? (
          <section
            className="flex min-w-0 flex-col gap-5"
            aria-label="Study library"
          >
            <InputGroup className="max-w-md">
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
            {visibleSets.length ? (
              <SetBrowserTree
                sets={visibleSets}
                activeSlug={null}
                onSelect={(slug) => navigate(`/sets/${slug}`)}
                resettableSetSlugs={resettableSetSlugs}
                onResetSet={resetSet}
                deletableSetSlugs={deletableSetSlugs}
                onDeleteSet={deleteSet}
                favoriteItems={favoriteItems}
                onFavoriteItem={addFavorite}
                onUnfavoriteItem={removeFavorite}
                className="w-full"
              />
            ) : (
              <Empty className="min-h-56">
                <EmptyHeader>
                  <EmptyTitle>No matching sets</EmptyTitle>
                  <EmptyDescription>
                    Try a different title or category.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="ghost" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </section>
        ) : (
          !displayError && (
            <Empty className="min-h-[22rem] px-4 py-12 sm:px-12">
              <EmptyHeader>
                <EmptyTitle>Your study library</EmptyTitle>
                <EmptyDescription>
                  Generate cards from a source, or import a study set.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                {actions}
              </EmptyContent>
            </Empty>
          )
        )}
      </main>
    </div>
  );
}
