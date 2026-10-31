import { deleteDB, openDB } from "idb";

import { LOCAL_STUDY_SET_DB_NAME } from "@/lib/app-config";
import { resetStoredStudyInteractionSets } from "@/lib/study-interactions-storage";
import { getStoredStudyPackIds } from "@/lib/study-pack-activation";
import {
  BUNDLED_STUDY_SET_SOURCE_TYPE,
  deriveSetSlug,
  getBundledStudySetSourcesForPackIds,
  normalizeStudySet,
  normalizeStoredStudySet,
} from "@/lib/study-sets";

export const LOCAL_STUDY_SET_DB_VERSION = 1;
export const LOCAL_STUDY_SET_STORE_NAME = "studySets";
export const DEFAULT_LOCAL_STUDY_SET_IMPORTED_AT = "2026-05-04T00:00:00.000Z";
export const IMPORTED_STUDY_SET_SOURCE_TYPE = "imported";

export class StudySetConflictError extends Error {
  constructor(slug, { bundled = false } = {}) {
    super(
      bundled
        ? `A bundled study set already uses the slug "${slug}" and cannot be replaced.`
        : `A study set already uses the slug "${slug}". Confirm replacement to overwrite it.`,
    );
    this.name = "StudySetConflictError";
    this.slug = slug;
    this.bundled = bundled;
  }
}

export class StudySetOwnershipError extends Error {
  constructor(slug) {
    super(`Bundled study set "${slug}" cannot be deleted.`);
    this.name = "StudySetOwnershipError";
    this.slug = slug;
  }
}

let dbPromise;

function getTimestamp() {
  return new Date().toISOString();
}

function assertIndexedDBAvailable() {
  if (typeof globalThis.indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this browser.");
  }
}

function getDatabase() {
  assertIndexedDBAvailable();

  if (!dbPromise) {
    dbPromise = openDB(LOCAL_STUDY_SET_DB_NAME, LOCAL_STUDY_SET_DB_VERSION, {
      blocking(_current, _blocked, event) {
        event.target.close();
      },
      upgrade(db) {
        if (!db.objectStoreNames.contains(LOCAL_STUDY_SET_STORE_NAME)) {
          db.createObjectStore(LOCAL_STUDY_SET_STORE_NAME, {
            keyPath: "slug",
          });
        }
      },
    });
  }

  return dbPromise;
}

export function sortLocalStudySetRecords(records) {
  return [...records].sort((left, right) => {
    const importedAtComparison = String(left.importedAt).localeCompare(
      String(right.importedAt),
    );

    if (importedAtComparison !== 0) {
      return importedAtComparison;
    }

    return String(left.slug).localeCompare(String(right.slug));
  });
}

function createStudySetRecord(
  set,
  { existingRecord, now = getTimestamp, source } = {},
) {
  const { slug, ...normalizedRawSet } = set;
  const timestamp = now();
  const record = {
    slug,
    rawSet: normalizedRawSet,
    importedAt: existingRecord?.importedAt ?? timestamp,
    updatedAt: timestamp,
  };

  if (source) {
    record.source = source;
  }

  return record;
}

export function createLocalStudySetRecord(rawSet, options = {}) {
  return createStudySetRecord(normalizeStudySet(rawSet), {
    ...options,
    source: { type: IMPORTED_STUDY_SET_SOURCE_TYPE },
  });
}

function createBundledStudySetRecord(source, existingRecord) {
  return createStudySetRecord(normalizeStoredStudySet(source.set), {
    existingRecord,
    now: () => DEFAULT_LOCAL_STUDY_SET_IMPORTED_AT,
    source: createBundledStudySetRecordSource(source),
  });
}

function createBundledStudySetRecordSource(source) {
  return {
    type: BUNDLED_STUDY_SET_SOURCE_TYPE,
    packId: source.packId,
    contentFingerprint: source.contentFingerprint,
  };
}

function isBundledStudySetRecordCurrent(record, source) {
  return (
    record?.source?.type === BUNDLED_STUDY_SET_SOURCE_TYPE &&
    record.source.packId === source.packId &&
    record.source.contentFingerprint === source.contentFingerprint
  );
}

function isBundledStudySetRecord(record, source) {
  if (record?.source) {
    return (
      record.source.type === BUNDLED_STUDY_SET_SOURCE_TYPE &&
      record.source.packId === source.packId
    );
  }

  return (
    record?.slug === source.slug &&
    record?.importedAt === DEFAULT_LOCAL_STUDY_SET_IMPORTED_AT
  );
}

async function syncDefaultStudySetRecords(db, records, studyPackIds) {
  const recordsBySlug = new Map(records.map((record) => [record.slug, record]));
  const syncedRecords = [];
  const refreshedSlugs = [];

  for (const source of getBundledStudySetSourcesForPackIds(studyPackIds)) {
    const existingRecord = recordsBySlug.get(source.slug);

    if (existingRecord && !isBundledStudySetRecord(existingRecord, source)) {
      continue;
    }

    if (isBundledStudySetRecordCurrent(existingRecord, source)) {
      continue;
    }

    const defaultRecord = createBundledStudySetRecord(source, existingRecord);

    await db.put(LOCAL_STUDY_SET_STORE_NAME, defaultRecord);
    recordsBySlug.set(defaultRecord.slug, defaultRecord);
    syncedRecords.push(defaultRecord);

    if (existingRecord) {
      refreshedSlugs.push(defaultRecord.slug);
    }
  }

  return { refreshedSlugs, syncedRecords };
}

export async function listLocalStudySetRecords({
  studyPackIds,
  interactionStorage,
  onInteractionSetsReset,
} = {}) {
  const db = await getDatabase();
  const records = await db.getAll(LOCAL_STUDY_SET_STORE_NAME);
  const syncedDefaultRecords = await syncDefaultStudySetRecords(
    db,
    records,
    studyPackIds ?? getStoredStudyPackIds(),
  );

  resetStoredStudyInteractionSets(syncedDefaultRecords.refreshedSlugs, {
    storage: interactionStorage,
  });
  onInteractionSetsReset?.(syncedDefaultRecords.refreshedSlugs);

  const syncedSlugs = new Set(
    syncedDefaultRecords.syncedRecords.map((record) => record.slug),
  );
  const unchangedRecords = records.filter(
    (record) => !syncedSlugs.has(record.slug),
  );

  return sortLocalStudySetRecords([
    ...unchangedRecords,
    ...syncedDefaultRecords.syncedRecords,
  ]);
}

export async function upsertLocalStudySet(
  rawSet,
  { replaceExisting = false, ...options } = {},
) {
  const db = await getDatabase();
  const slug = deriveSetSlug(rawSet);
  const existingRecord = await db.get(LOCAL_STUDY_SET_STORE_NAME, slug);

  if (existingRecord?.source?.type === BUNDLED_STUDY_SET_SOURCE_TYPE) {
    throw new StudySetConflictError(slug, { bundled: true });
  }

  if (existingRecord && !replaceExisting) {
    throw new StudySetConflictError(slug);
  }

  const record = createLocalStudySetRecord(rawSet, {
    ...options,
    existingRecord,
  });

  await db.put(LOCAL_STUDY_SET_STORE_NAME, record);

  return {
    record,
    replaced: Boolean(existingRecord),
  };
}

export async function deleteLocalStudySet(slug) {
  const db = await getDatabase();
  const record = await db.get(LOCAL_STUDY_SET_STORE_NAME, slug);

  if (!record) {
    return false;
  }

  if (!isLocalStudySetRecordDeletable(record)) {
    throw new StudySetOwnershipError(slug);
  }

  await db.delete(LOCAL_STUDY_SET_STORE_NAME, slug);
  return true;
}

export function isLocalStudySetRecordDeletable(record) {
  return (
    Boolean(record) &&
    record.source?.type !== BUNDLED_STUDY_SET_SOURCE_TYPE &&
    !(
      (record.source === null || record.source === undefined) &&
      record.importedAt === DEFAULT_LOCAL_STUDY_SET_IMPORTED_AT
    )
  );
}

export async function closeLocalStudySetDatabase() {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
    dbPromise = null;
  }
}

export async function resetLocalStudySetDatabaseForTests() {
  await closeLocalStudySetDatabase();
  await deleteDB(LOCAL_STUDY_SET_DB_NAME);
}

export const localStudySetStorage = {
  list: listLocalStudySetRecords,
  upsert: upsertLocalStudySet,
  delete: deleteLocalStudySet,
};
