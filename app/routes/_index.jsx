import * as React from "react";
import { Button } from "@/components/ui/button";
import { getCapabilities, useCapabilities } from "@/lib/runtime-client";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";

import { SetBrowserTree } from "@/components/study/set-browser-tree";
import {
  StudyAppHeader,
  STUDY_APP_HEADER_HEIGHT,
} from "@/components/study/study-app-header";
import { StudySetImportDropzone } from "@/components/study/study-set-import-dropzone";
import { formatPageTitle } from "@/lib/app-config";
import { listStudySetRecords } from "@/lib/runtime-study-set-storage";
import { activateStudyPacksFromUrl } from "@/lib/study-pack-activation";
import {
  initializeStoredStudyFavorites,
  resolveFavoriteStart,
  setStoredStudyFavorites,
} from "@/lib/study-favorites";
import { selectLocalStudySets } from "@/lib/study-sets";
import {
  useHydrateStudyFavoritesStore,
  useStudyFavoritesStore,
} from "@/stores/use-study-favorites-store";
import {
  useHydrateStudySetsStore,
  useStudySetsStore,
} from "@/stores/use-study-sets-store";

export function meta() {
  return [{ title: formatPageTitle() }];
}

export async function clientLoader({ request }) {
  let records;

  try {
    activateStudyPacksFromUrl(request.url);
    records = await listStudySetRecords();
  } catch {
    return {
      records: [],
      favorites: null,
      storageError: "Study sets could not be loaded.",
    };
  }

  if ((await getCapabilities()).server) {
    // Runtime sync owns server favorites, including pending local edits.
    return { records, favorites: null, storageError: null };
  }

  const sets = selectLocalStudySets(records);
  const start = resolveFavoriteStart(
    sets,
    initializeStoredStudyFavorites(sets),
  );

  if (start.changed) {
    setStoredStudyFavorites(start.favorites);
  }

  if (start.mode === "redirect") {
    throw redirect(`/sets/${start.slug}`);
  }

  return {
    records,
    favorites: start.favorites,
    storageError: null,
  };
}

export default function IndexRoute() {
  const { records, favorites, storageError } = useLoaderData();
  const capabilities = useCapabilities();
  const navigate = useNavigate();
  const [menuPanelOpen, setMenuPanelOpen] = React.useState(false);
  const storeRecords = useStudySetsStore((state) => state.records);
  const storageStatus = useStudySetsStore((state) => state.status);
  const favoriteItems = useStudyFavoritesStore((state) => state.favorites);
  const setFavorites = useStudyFavoritesStore((state) => state.setFavorites);
  const addFavorite = useStudyFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useStudyFavoritesStore(
    (state) => state.removeFavorite,
  );
  const localRecords = storageStatus === "ready" ? storeRecords : records;
  const sets = React.useMemo(
    () => selectLocalStudySets(localRecords),
    [localRecords],
  );
  const start = React.useMemo(
    () => resolveFavoriteStart(sets, favoriteItems),
    [favoriteItems, sets],
  );
  const favoriteNodes = start.mode === "favorites" ? start.nodes : [];

  useHydrateStudySetsStore(records, storageError);
  useHydrateStudyFavoritesStore(favorites);

  React.useEffect(() => {
    if (capabilities && !capabilities.server && start.changed) {
      setFavorites(start.favorites);
    }
  }, [capabilities, setFavorites, start]);

  React.useEffect(() => {
    if (!capabilities?.server && !menuPanelOpen && start.mode === "redirect") {
      navigate(`/sets/${start.slug}`, { replace: true });
    }
  }, [capabilities?.server, menuPanelOpen, navigate, start]);

  return (
    <div
      className="flex min-h-dvh w-full flex-col bg-background"
      style={{
        "--study-app-header-height": `${STUDY_APP_HEADER_HEIGHT}px`,
      }}
    >
      <StudyAppHeader activeSlug={null} onMenuOpenChange={setMenuPanelOpen} />
      <main
        className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-8 sm:px-6"
        style={{ alignItems: "safe center" }}
      >
        {capabilities?.server ? (
          <section className="flex w-full flex-col gap-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-headline-lg">Study sets</h1>
              <Button asChild>
                <Link to="/generate">Generate cards</Link>
              </Button>
            </div>
            {sets.length ? (
              <SetBrowserTree
                sets={sets}
                activeSlug={null}
                onSelect={(slug) => navigate(`/sets/${slug}`)}
                favoriteItems={favoriteItems}
                onFavoriteItem={addFavorite}
                onUnfavoriteItem={removeFavorite}
                className="w-full"
              />
            ) : (
              <p className="text-muted-foreground">
                Add a source to create your first study set.
              </p>
            )}
            <StudySetImportDropzone
              variant="compact"
              onImported={(record) => navigate(`/sets/${record.slug}`)}
              className="self-start"
            />
          </section>
        ) : favoriteNodes.length ? (
          <section
            aria-labelledby="favorites-title"
            className="flex w-full flex-col gap-3"
          >
            <h1 id="favorites-title" className="text-headline-md">
              Favorites
            </h1>
            <SetBrowserTree
              nodes={favoriteNodes}
              activeSlug={null}
              onSelect={(slug) => navigate(`/sets/${slug}`)}
              favoriteItems={favoriteItems}
              onFavoriteItem={addFavorite}
              onUnfavoriteItem={removeFavorite}
              className="w-full"
            />
          </section>
        ) : (
          <StudySetImportDropzone
            onImported={(record) => navigate(`/sets/${record.slug}`)}
            className="w-full"
          />
        )}
      </main>
      {storageError ? (
        <p className="sr-only" role="alert">
          {storageError}
        </p>
      ) : null}
    </div>
  );
}
