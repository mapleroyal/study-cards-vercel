import * as React from "react";
import { getCapabilities } from "@/lib/runtime-client";
import { runtimeStudySetStorage } from "@/lib/runtime-study-set-storage";
import { create } from "zustand";

import { StudySetConflictError } from "@/lib/local-study-set-storage";
import {
  getStudySetImportErrorMessage,
  validateStudySetImport,
} from "@/lib/study-set-validation";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";
import { useStudyReaderStore } from "@/stores/use-study-reader-store";

function getStoreErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Study sets could not be loaded.";
}

export function createStudySetsStore({
  storage = runtimeStudySetStorage,
  studyInteractionsStore = useStudyInteractionsStore,
  studyReaderStore = useStudyReaderStore,
} = {}) {
  let pendingLoad = null;

  async function listRecords() {
    let cacheError = null;
    const records = await storage.list({
      onInteractionSetsReset: (setSlugs) =>
        studyInteractionsStore.getState().resetSets?.(setSlugs),
      onCacheFallback: (error) => {
        cacheError = getStoreErrorMessage(error);
      },
    });
    return { records, error: cacheError };
  }

  return create((set, get) => ({
    records: [],
    status: "idle",
    error: null,
    hydrate: (records, error = null) =>
      set({
        records,
        status: error ? "error" : "ready",
        error,
      }),
    load: async () => {
      if (pendingLoad) {
        return pendingLoad;
      }

      set({ status: "loading", error: null });

      pendingLoad = listRecords()
        .then(({ records, error }) => {
          set({
            records,
            status: error ? "error" : "ready",
            error,
          });

          return records;
        })
        .catch((error) => {
          const message = getStoreErrorMessage(error);

          set({
            records: [],
            status: "error",
            error: message,
          });

          throw error;
        })
        .finally(() => {
          pendingLoad = null;
        });

      return pendingLoad;
    },
    importStudySet: async (rawSet, { replaceExisting = false } = {}) => {
      const validatedSet = validateStudySetImport(rawSet);
      const { record } = await storage.upsert(validatedSet, {
        replaceExisting,
      });

      if (
        storage !== runtimeStudySetStorage ||
        !(await getCapabilities()).server
      ) {
        studyInteractionsStore.getState().resetSet(record.slug);
      }

      const { records, error } = await listRecords();
      set({
        records,
        status: error ? "error" : "ready",
        error,
      });

      return record;
    },
    deleteStudySet: async (slug) => {
      await storage.delete(slug);
      studyReaderStore.getState().resetQuestionOrder(slug);
      if (
        storage !== runtimeStudySetStorage ||
        !(await getCapabilities()).server
      ) {
        studyInteractionsStore.getState().resetSet(slug);
      }

      const { records, error } = await listRecords();
      set({
        records,
        status: error ? "error" : "ready",
        error,
      });

      return records;
    },
    clearError: () => {
      if (get().error !== null) {
        set({ error: null });
      }
    },
  }));
}

export const useStudySetsStore = createStudySetsStore();

export function isReplaceableStudySetConflict(error) {
  return error instanceof StudySetConflictError && !error.bundled;
}

export function useLoadStudySets() {
  const status = useStudySetsStore((state) => state.status);
  const load = useStudySetsStore((state) => state.load);

  React.useEffect(() => {
    if (status === "idle") {
      load().catch(() => undefined);
    }
  }, [load, status]);
}

export function useHydrateStudySetsStore(records, error = null) {
  React.useEffect(() => {
    useStudySetsStore.getState().hydrate(records, error);
  }, [error, records]);
}

export { getStudySetImportErrorMessage };
