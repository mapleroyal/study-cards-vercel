import * as React from "react";
import { create } from "zustand";

import {
  addFavoriteItem,
  getStoredStudyFavorites,
  normalizeFavoriteItems,
  pruneFavoriteItems,
  removeFavoriteItem,
  setStoredStudyFavorites,
  toggleFavoriteItem,
} from "@/lib/study-favorites";

function persistFavorites(favorites, storage) {
  return setStoredStudyFavorites(favorites, storage);
}

export function createStudyFavoritesStore({ storage } = {}) {
  return create((set, get) => ({
    favorites: getStoredStudyFavorites(storage),
    hydrate: (favorites) => {
      const nextFavorites = normalizeFavoriteItems(favorites);
      try {
        persistFavorites(nextFavorites, storage);
      } catch {
        // A server snapshot remains usable when browser storage is unavailable.
      }
      set({ favorites: nextFavorites });
    },
    setFavorites: (favorites) => {
      const nextFavorites = persistFavorites(favorites, storage);

      set({ favorites: nextFavorites });
      return nextFavorites;
    },
    addFavorite: (favorite) => {
      const nextFavorites = persistFavorites(
        addFavoriteItem(get().favorites, favorite),
        storage,
      );

      set({ favorites: nextFavorites });
      return nextFavorites;
    },
    removeFavorite: (favorite) => {
      const nextFavorites = persistFavorites(
        removeFavoriteItem(get().favorites, favorite),
        storage,
      );

      set({ favorites: nextFavorites });
      return nextFavorites;
    },
    toggleFavorite: (favorite) => {
      const nextFavorites = persistFavorites(
        toggleFavoriteItem(get().favorites, favorite),
        storage,
      );

      set({ favorites: nextFavorites });
      return nextFavorites;
    },
    pruneFavorites: (sets) => {
      const { favorites } = pruneFavoriteItems(get().favorites, sets);
      const nextFavorites = persistFavorites(favorites, storage);

      set({ favorites: nextFavorites });
      return nextFavorites;
    },
  }));
}

export const useStudyFavoritesStore = createStudyFavoritesStore();

export function useHydrateStudyFavoritesStore(favorites) {
  React.useEffect(() => {
    if (favorites !== null) {
      useStudyFavoritesStore.getState().hydrate(favorites);
    }
  }, [favorites]);
}
