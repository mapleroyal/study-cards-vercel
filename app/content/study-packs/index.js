const packMetadataModules = import.meta.glob("./*/pack.json", {
  eager: true,
  import: "default",
});

const studySetModules = import.meta.glob("./*/*.json", {
  eager: true,
  import: "default",
});

function getPackDirectory(path) {
  return path.match(/^\.\/([^/]+)\//)?.[1] ?? "";
}

function slugifyDirectoryName(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const studySetsByDirectory = Object.entries(studySetModules).reduce(
  (packs, [path, studySet]) => {
    if (path.endsWith("/pack.json")) {
      return packs;
    }

    const directory = getPackDirectory(path);
    const existingSets = packs.get(directory) ?? [];

    packs.set(directory, [...existingSets, { path, studySet }]);

    return packs;
  },
  new Map(),
);

export const studyPacks = Object.entries(packMetadataModules)
  .map(([metadataPath, metadata]) => {
    const directory = getPackDirectory(metadataPath);
    const id = slugifyDirectoryName(directory);
    const studySets = (studySetsByDirectory.get(directory) ?? [])
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({ studySet }) => studySet);

    return {
      ...metadata,
      id,
      directory,
      studySets,
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));
