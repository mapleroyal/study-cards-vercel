export const APP_NAME = "Lumina";
export const APP_VERSION = import.meta.env.VITE_LUMINA_APP_VERSION ?? "1.0.0";
export const APP_DESCRIPTION = "A minimal interactive study-card app.";
export const APP_STORAGE_PREFIX = "lumina";

export const THEME_STORAGE_KEY = `${APP_STORAGE_PREFIX}:theme`;
export const STUDY_INTERACTIONS_STORAGE_KEY = `${APP_STORAGE_PREFIX}:study-interactions`;
export const STUDY_READER_STORAGE_KEY = `${APP_STORAGE_PREFIX}:study-reader`;
export const STUDY_FAVORITES_STORAGE_KEY = `${APP_STORAGE_PREFIX}:study-favorites`;
export const STUDY_SET_GENERATION_STORAGE_KEY = `${APP_STORAGE_PREFIX}:study-set-generation`;
export const STUDY_PACKS_STORAGE_KEY = `${APP_STORAGE_PREFIX}:study-packs`;
export const STUDY_PACK_DEFAULTS_STORAGE_KEY = `${APP_STORAGE_PREFIX}:study-pack-defaults-applied`;
export const LOCAL_STUDY_SET_DB_NAME = `${APP_STORAGE_PREFIX}:study-sets`;

export function formatPageTitle(title) {
  return title ? `${title} - ${APP_NAME}` : APP_NAME;
}
