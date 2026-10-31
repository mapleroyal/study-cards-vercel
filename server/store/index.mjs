import pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { validateStudySetImport } from "../../shared/study-set-validation.js";

const namespaces = {
  sets: "study-sets",
  progress: "progress",
  favorites: "favorites",
  imports: "browser-imports",
};
const protectedNamespaces = new Set(Object.values(namespaces));
const identifier = z.string().trim().min(1);
const favoriteSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set"), slug: identifier }),
  z.object({ type: z.literal("category"), path: z.string().trim().min(1) }),
]);
function problem(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}
const serialize = (value) => JSON.stringify(canonical(value));
const hash = (value) =>
  createHash("sha256").update(serialize(value)).digest("hex");
const progressKey = (setId, cardId) => JSON.stringify([setId, cardId]);
const slugify = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
function normalizeSet(input) {
  let set;
  try {
    set = validateStudySetImport(input);
  } catch (error) {
    error.status = 400;
    throw error;
  }
  set.category = set.category
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return set;
}
function normalizedFavorites(value) {
  const items = z
    .array(favoriteSchema)
    .parse(value)
    .map((item) =>
      item.type === "category"
        ? {
            ...item,
            path: item.path
              .split("/")
              .map((part) => part.trim())
              .filter(Boolean)
              .join("/"),
          }
        : item,
    );
  return [
    ...new Map(
      items
        .filter((item) => item.type !== "category" || item.path)
        .map((item) => [serialize(item), item]),
    ).values(),
  ];
}
function validateInteraction(card, input) {
  const patch = z
    .object({
      answerOpen: z.boolean().optional(),
      selectedOption: z.string().nullable().optional(),
      selectedOptions: z.array(z.string()).optional(),
      selectedAnswer: z.boolean().nullable().optional(),
      response: z.string().optional(),
      items: z.array(z.string()).optional(),
      assignments: z.array(z.array(z.string())).optional(),
    })
    .strict()
    .parse(input);
  const allowed = new Set([
    "answerOpen",
    ...({
      multiple_choice: ["selectedOption"],
      multiple_response: ["selectedOptions"],
      true_false: ["selectedAnswer"],
      short_answer: ["response"],
      fill_in_the_blank: ["response"],
      ordering: ["items"],
      matching: ["assignments"],
    }[card.type] || []),
  ]);
  if (Object.keys(patch).some((key) => !allowed.has(key))) {
    throw problem("Progress fields do not match this card type.");
  }
  if (
    patch.selectedOption !== null &&
    patch.selectedOption !== undefined &&
    !Object.hasOwn(card.options || {}, patch.selectedOption)
  ) {
    throw problem("Selected option does not exist.");
  }
  if (
    patch.selectedOptions &&
    (new Set(patch.selectedOptions).size !== patch.selectedOptions.length ||
      patch.selectedOptions.some(
        (key) => !Object.hasOwn(card.options || {}, key),
      ))
  ) {
    throw problem("Selected options do not match this card.");
  }
  if (
    patch.items &&
    serialize([...patch.items].sort()) !==
      serialize([...card.unordered_items].sort())
  ) {
    throw problem("Ordering items do not match this card.");
  }
  if (patch.assignments) {
    const assigned = patch.assignments.flat();
    if (
      patch.assignments.length !== card.prompts.length ||
      new Set(assigned).size !== assigned.length ||
      assigned.some((choice) => !card.choices.includes(choice))
    ) {
      throw problem("Matching assignments do not match this card.");
    }
  }
  return patch;
}

const schema = `
  CREATE TABLE IF NOT EXISTS lumina_meta (
    id smallint PRIMARY KEY CHECK (id = 1), revision integer NOT NULL
  );
  INSERT INTO lumina_meta (id, revision) VALUES (1, 0) ON CONFLICT DO NOTHING;
  CREATE TABLE IF NOT EXISTS lumina_records (
    ordinal bigserial UNIQUE,
    namespace text NOT NULL,
    id text NOT NULL,
    data text NOT NULL CHECK (json_typeof(data::json) IS NOT NULL),
    revision integer NOT NULL,
    PRIMARY KEY (namespace, id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS lumina_study_set_slug
    ON lumina_records ((data::jsonb->>'slug')) WHERE namespace = 'study-sets';
  CREATE TABLE IF NOT EXISTS lumina_mutations (
    id text PRIMARY KEY,
    revision integer NOT NULL,
    action text NOT NULL,
    label text NOT NULL,
    request_hash text NOT NULL,
    result text NOT NULL,
    patches text NOT NULL,
    created_at text NOT NULL,
    undone_at text
  );
  CREATE INDEX IF NOT EXISTS lumina_mutations_revision ON lumina_mutations(revision);
`;

// Every writer locks the one deployment's revision row. The same transaction
// covers state changes, idempotency receipts and undo patches across instances.
export function createStudyStore({
  connectionString = process.env.DATABASE_URL,
  pool: suppliedPool,
  now = () => new Date().toISOString(),
} = {}) {
  if (!suppliedPool && !connectionString) {
    throw new Error("DATABASE_URL is required for the hosted study library.");
  }
  const pool = suppliedPool || new pg.Pool({ connectionString, max: 5 });
  if (!suppliedPool) {
    // pg removes a disconnected idle client itself. Handle its error event so
    // a managed database/network restart does not crash unrelated requests.
    pool.on("error", (error) => {
      console.error("database_idle_connection_failed", {
        name: error.name,
        code: error.code,
      });
    });
  }
  let initializing;
  function initialize() {
    if (!initializing) {
      initializing = (async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          // Cold starts can overlap on a new deployment. Serialize schema setup.
          await client.query("SELECT pg_advisory_xact_lock(1280658761)");
          await client.query(schema);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      })().catch((error) => {
        initializing = null;
        throw error;
      });
    }
    return initializing;
  }
  async function query(sql, parameters = []) {
    await initialize();
    return pool.query(sql, parameters);
  }
  function session(client, context = {}) {
    const rows = async (sql, parameters = []) =>
      (await client.query(sql, parameters)).rows;
    const one = async (sql, parameters = []) =>
      (await rows(sql, parameters))[0] || null;
    const raw = async (namespace, id) =>
      (
        await one(
          "SELECT data FROM lumina_records WHERE namespace = $1 AND id = $2",
          [namespace, id],
        )
      )?.data ?? null;
    const read = async (namespace, id) => {
      const data = await raw(namespace, id);
      return data === null ? null : JSON.parse(data);
    };
    const list = async (namespace) =>
      (
        await rows(
          "SELECT data FROM lumina_records WHERE namespace = $1 ORDER BY ordinal",
          [namespace],
        )
      ).map((row) => JSON.parse(row.data));
    async function write(namespace, id, value, { track = true } = {}) {
      const before = await raw(namespace, id);
      // JSON text preserves the insertion order of multiple-choice options.
      const after = value === null ? null : JSON.stringify(value);
      if (before === after) {
        return;
      }
      if (context.patches && track) {
        const key = JSON.stringify([namespace, id]);
        const previous = context.patches.get(key);
        context.patches.set(key, {
          namespace,
          id,
          before: previous ? previous.before : before,
          after,
        });
      }
      if (after === null) {
        await client.query(
          "DELETE FROM lumina_records WHERE namespace = $1 AND id = $2",
          [namespace, id],
        );
      } else {
        await client.query(
          "INSERT INTO lumina_records (namespace, id, data, revision) VALUES ($1, $2, $3, $4) ON CONFLICT (namespace, id) DO UPDATE SET data = EXCLUDED.data, revision = EXCLUDED.revision",
          [namespace, id, after, context.revision],
        );
      }
    }
    async function getStudySet(idOrSlug) {
      const row = await one(
        "SELECT data, revision FROM lumina_records WHERE namespace = $1 AND (id = $2 OR data::jsonb->>'slug' = $2) ORDER BY (id = $2) DESC LIMIT 1",
        [namespaces.sets, String(idOrSlug)],
      );
      return row ? { ...JSON.parse(row.data), revision: row.revision } : null;
    }
    async function requireSet(idOrSlug, options = {}) {
      const record = await getStudySet(idOrSlug);
      if (!record) {
        throw problem("Study set not found.", 404);
      }
      if (
        options.expectedRevision !== undefined &&
        options.expectedRevision !== record.revision
      ) {
        throw problem(
          "The study set changed. Reload it before applying this action.",
          409,
        );
      }
      return record;
    }
    const listStudySets = async () =>
      (
        await rows(
          "SELECT data, revision FROM lumina_records WHERE namespace = $1 ORDER BY ordinal",
          [namespaces.sets],
        )
      ).map((row) => ({ ...JSON.parse(row.data), revision: row.revision }));
    async function insertSet(input, options = {}) {
      const rawSet = normalizeSet(input);
      const id = randomUUID();
      const base =
        slugify(options.slug || `${rawSet.category}/${rawSet.title}`) ||
        "study-set";
      let slug = base;
      for (let suffix = 2; await getStudySet(slug); suffix++) {
        slug = `${base}-${suffix}`;
      }
      const timestamp = now();
      await write(namespaces.sets, id, {
        id,
        slug,
        rawSet,
        source: options.source || { type: "imported" },
        importedAt: options.importedAt || timestamp,
        updatedAt: timestamp,
      });
      return getStudySet(id);
    }
    async function getInteractions() {
      const sets = new Map((await listStudySets()).map((set) => [set.id, set]));
      const result = {};
      for (const item of await list(namespaces.progress)) {
        const set = sets.get(item.setId);
        if (set) {
          (result[set.slug] ||= {})[item.cardId] = item.patch;
        }
      }
      return result;
    }
    const getFavorites = async () =>
      (await read(namespaces.favorites, "all")) || [];
    async function validFavorites(items) {
      const sets = await listStudySets();
      const slugs = new Set(sets.map((set) => set.slug));
      const categories = new Set(
        sets.flatMap((set) => {
          const parts = set.rawSet.category.split("/");
          return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
        }),
      );
      return normalizedFavorites(items).filter((item) =>
        item.type === "set" ? slugs.has(item.slug) : categories.has(item.path),
      );
    }
    async function setProgress(record, cardId, input, merge = true) {
      const id = z.coerce.number().int().nonnegative().parse(cardId);
      const card = record.rawSet.cards.find((candidate) => candidate.id === id);
      if (!card) {
        throw problem("Card not found.", 404);
      }
      const key = progressKey(record.id, id);
      const previous = merge
        ? (await read(namespaces.progress, key))?.patch || {}
        : {};
      const patch = validateInteraction(card, { ...previous, ...input });
      await write(
        namespaces.progress,
        key,
        Object.keys(patch).length
          ? {
              setId: record.id,
              cardId: id,
              cardVersion: serialize(card),
              patch,
            }
          : null,
      );
      return patch;
    }
    return {
      rows,
      one,
      raw,
      read,
      list,
      write,
      getStudySet,
      requireSet,
      listStudySets,
      insertSet,
      getInteractions,
      getFavorites,
      validFavorites,
      setProgress,
    };
  }
  const reads = session({ query });
  async function transaction(execute) {
    await initialize();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [meta],
      } = await client.query(
        "SELECT revision FROM lumina_meta WHERE id = 1 FOR UPDATE",
      );
      const context = { revision: meta.revision };
      const result = await execute(session(client, context), context, client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  async function mutate(action, args, options = {}, execute) {
    const mutationId = identifier.parse(options.mutationId || randomUUID());
    const requestHash = hash({ action, args });
    return transaction(async (tx, context, client) => {
      const prior = await tx.one(
        "SELECT request_hash, result FROM lumina_mutations WHERE id = $1",
        [mutationId],
      );
      if (prior) {
        if (prior.request_hash !== requestHash) {
          throw problem(
            "This mutation ID was already used for another action.",
            409,
          );
        }
        return JSON.parse(prior.result);
      }
      if (
        !["study_set.update", "study_set.delete"].includes(action) &&
        options.expectedRevision !== undefined &&
        options.expectedRevision !== context.revision
      ) {
        throw problem(
          "The library changed. Reload it before applying this action.",
          409,
        );
      }
      context.revision++;
      context.patches = new Map();
      const value = await execute(tx);
      const result = { ...value, mutationId, revision: context.revision };
      const patches = [...context.patches.values()].filter(
        (patch) => patch.before !== patch.after,
      );
      await client.query("UPDATE lumina_meta SET revision = $1 WHERE id = 1", [
        result.revision,
      ]);
      await client.query(
        "INSERT INTO lumina_mutations (id, revision, action, label, request_hash, result, patches, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          mutationId,
          result.revision,
          action,
          options.label || action,
          requestHash,
          JSON.stringify(result),
          JSON.stringify(patches),
          now(),
        ],
      );
      return result;
    });
  }
  async function undo(tx, id) {
    const mutation = await tx.one(
      "SELECT * FROM lumina_mutations WHERE id = $1",
      [id],
    );
    if (!mutation) {
      throw problem("Change not found.", 404);
    }
    if (mutation.undone_at) {
      throw problem("This change has already been undone.", 409);
    }
    if (mutation.action === "library.undo") {
      throw problem("Undo cannot itself be undone.", 409);
    }
    const patches = JSON.parse(mutation.patches);
    for (const patch of patches.filter(
      (item) => item.namespace === namespaces.sets,
    )) {
      if (patch.before !== null) {
        const occupying = await tx.getStudySet(JSON.parse(patch.before).slug);
        if (occupying && occupying.id !== patch.id) {
          throw problem(
            "Another set now uses this address. Rename or remove it before undoing.",
            409,
          );
        }
      } else if (patch.after !== null) {
        const affected = new Set(
          patches.map((item) => JSON.stringify([item.namespace, item.id])),
        );
        const added = JSON.parse(patch.after);
        const laterProgress = (await tx.list(namespaces.progress)).some(
          (item) =>
            item.setId === patch.id &&
            !affected.has(
              JSON.stringify([
                namespaces.progress,
                progressKey(item.setId, item.cardId),
              ]),
            ),
        );
        const laterFavorite =
          (await tx.getFavorites()).some(
            (item) => item.type === "set" && item.slug === added.slug,
          ) && !affected.has(JSON.stringify([namespaces.favorites, "all"]));
        if (laterProgress || laterFavorite) {
          throw problem(
            "A later change uses this study set. Undo the later change first.",
            409,
          );
        }
      }
    }
    for (const patch of patches) {
      if ((await tx.raw(patch.namespace, patch.id)) !== patch.after) {
        throw problem(
          "A later change affects this action. Undo the later change first.",
          409,
        );
      }
    }
    const projectedSets = new Map(
      (await tx.listStudySets()).map((record) => [record.id, record]),
    );
    const projectedProgress = new Map(
      (await tx.list(namespaces.progress)).map((item) => [
        progressKey(item.setId, item.cardId),
        item,
      ]),
    );
    let projectedFavorites = await tx.getFavorites();
    for (const patch of patches) {
      const before = patch.before === null ? null : JSON.parse(patch.before);
      if (patch.namespace === namespaces.sets) {
        if (before === null) {
          projectedSets.delete(patch.id);
        } else {
          projectedSets.set(patch.id, before);
        }
      } else if (patch.namespace === namespaces.progress) {
        if (before === null) {
          projectedProgress.delete(patch.id);
        } else {
          projectedProgress.set(patch.id, before);
        }
      } else if (patch.namespace === namespaces.favorites) {
        projectedFavorites = before || [];
      }
    }
    for (const item of projectedProgress.values()) {
      const card = projectedSets
        .get(item.setId)
        ?.rawSet.cards.find((candidate) => candidate.id === item.cardId);
      if (!card || item.cardVersion !== serialize(card)) {
        throw problem(
          "A later card or progress change conflicts with this undo. Undo the later change first.",
          409,
        );
      }
    }
    const projectedSlugs = new Set(
      [...projectedSets.values()].map((record) => record.slug),
    );
    const projectedCategories = new Set(
      [...projectedSets.values()].flatMap((record) => {
        const parts = record.rawSet.category.split("/");
        return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
      }),
    );
    if (
      projectedFavorites.some((item) =>
        item.type === "set"
          ? !projectedSlugs.has(item.slug)
          : !projectedCategories.has(item.path),
      )
    ) {
      throw problem(
        "A later favorite change conflicts with this undo. Undo the later change first.",
        409,
      );
    }
    for (const patch of [...patches].reverse()) {
      await tx.write(
        patch.namespace,
        patch.id,
        patch.before === null ? null : JSON.parse(patch.before),
      );
    }
    await tx.rows("UPDATE lumina_mutations SET undone_at = $1 WHERE id = $2", [
      now(),
      id,
    ]);
    return {
      undone: true,
      undoneMutationId: id,
      records: await tx.listStudySets(),
      interactionsBySet: await tx.getInteractions(),
      favorites: await tx.getFavorites(),
    };
  }
  function checkNamespace(namespace, id) {
    identifier.parse(namespace);
    identifier.parse(id);
    if (protectedNamespaces.has(namespace)) {
      throw problem("Use the typed study-library operations for this record.");
    }
  }
  const store = {
    pool,
    initialize,
    close: () => pool.end(),
    async getRevision() {
      return (await query("SELECT revision FROM lumina_meta WHERE id = 1"))
        .rows[0].revision;
    },
    listStudySets: reads.listStudySets,
    getStudySet: reads.getStudySet,
    getInteractions: reads.getInteractions,
    getFavorites: reads.getFavorites,
    async snapshot() {
      return transaction(async (tx, context) => ({
        records: await tx.listStudySets(),
        interactionsBySet: await tx.getInteractions(),
        favorites: await tx.getFavorites(),
        revision: context.revision,
      }));
    },
    createStudySet(input, options = {}) {
      return mutate(
        "study_set.create",
        {
          input,
          source: options.source,
          slug: options.slug,
          generationJobId: options.generationJobId,
        },
        options,
        async (tx) => {
          let job;
          if (options.generationJobId) {
            job = await tx.read("jobs", options.generationJobId);
            const source = job?.sourceId
              ? await tx.read("sources", job.sourceId)
              : null;
            if (
              !job ||
              ["canceled", "failed", "completed"].includes(job.status) ||
              !source ||
              source.status === "deleting"
            ) {
              throw problem("This generation is no longer active.", 409);
            }
          }
          const record = await tx.insertSet(input, options);
          if (job) {
            await tx.write(
              "jobs",
              job.id,
              {
                ...job,
                status: "completed",
                resultRecord: record,
                completedAt: now(),
                error: null,
              },
              { track: false },
            );
          }
          return { record };
        },
      );
    },
    updateStudySet(idOrSlug, input, options = {}) {
      return mutate(
        "study_set.update",
        { idOrSlug, input },
        options,
        async (tx) => {
          const existing = await tx.requireSet(idOrSlug, options);
          const patch = z
            .object({
              title: z.string().optional(),
              category: z.string().optional(),
              cards: z.array(z.unknown()).optional(),
              upsertCards: z
                .array(
                  z
                    .object({ id: z.number().int().nonnegative() })
                    .passthrough(),
                )
                .optional(),
              removeCardIds: z.array(z.number().int().nonnegative()).optional(),
            })
            .strict()
            .parse(input);
          if (patch.cards && (patch.upsertCards || patch.removeCardIds)) {
            throw problem("Use cards or a card patch, not both.");
          }
          let cards = patch.cards || existing.rawSet.cards;
          if (patch.upsertCards || patch.removeCardIds) {
            const removal = new Set(patch.removeCardIds || []);
            const updates = new Map(
              (patch.upsertCards || []).map((card) => [card.id, card]),
            );
            if (updates.size !== (patch.upsertCards || []).length) {
              throw problem("Card IDs must be unique.");
            }
            cards = cards
              .filter((card) => !removal.has(card.id))
              .map((card) => {
                const update = updates.get(card.id);
                updates.delete(card.id);
                return update || card;
              });
            cards.push(...updates.values());
          }
          const rawSet = normalizeSet({
            ...existing.rawSet,
            title: patch.title ?? existing.rawSet.title,
            category: patch.category ?? existing.rawSet.category,
            cards,
          });
          const nextCards = new Map(
            rawSet.cards.map((card) => [card.id, card]),
          );
          for (const card of existing.rawSet.cards) {
            if (serialize(card) !== serialize(nextCards.get(card.id))) {
              await tx.write(
                namespaces.progress,
                progressKey(existing.id, card.id),
                null,
              );
            }
          }
          const record = { ...existing };
          delete record.revision;
          await tx.write(namespaces.sets, existing.id, {
            ...record,
            rawSet,
            updatedAt: now(),
          });
          await tx.write(
            namespaces.favorites,
            "all",
            await tx.validFavorites(await tx.getFavorites()),
          );
          return { record: await tx.getStudySet(existing.id) };
        },
      );
    },
    deleteStudySet(idOrSlug, options = {}) {
      return mutate("study_set.delete", { idOrSlug }, options, async (tx) => {
        const record = await tx.requireSet(idOrSlug, options);
        await tx.write(namespaces.sets, record.id, null);
        for (const card of record.rawSet.cards) {
          await tx.write(
            namespaces.progress,
            progressKey(record.id, card.id),
            null,
          );
        }
        await tx.write(
          namespaces.favorites,
          "all",
          await tx.validFavorites(await tx.getFavorites()),
        );
        return { deleted: true, id: record.id, slug: record.slug };
      });
    },
    setInteraction(idOrSlug, cardId, patch, options = {}) {
      return mutate(
        "progress.set",
        {
          idOrSlug,
          cardId,
          patch,
          replace: options.replace === true,
          cardVersion: options.cardVersion,
          expectedCard: options.expectedCard,
        },
        options,
        async (tx) => {
          const record = await tx.requireSet(idOrSlug);
          const currentCard = record.rawSet.cards.find(
            (card) => card.id === Number(cardId),
          );
          let expectedCard = options.expectedCard;
          if (options.cardVersion !== undefined) {
            try {
              expectedCard = JSON.parse(options.cardVersion);
            } catch {
              throw problem("Invalid card version.");
            }
          }
          if (
            expectedCard !== undefined &&
            serialize(expectedCard) !== serialize(currentCard)
          ) {
            throw problem(
              "This card changed. Reload it before saving an answer.",
              409,
            );
          }
          return {
            slug: record.slug,
            cardId: Number(cardId),
            patch: await tx.setProgress(
              record,
              cardId,
              patch,
              options.replace !== true,
            ),
          };
        },
      );
    },
    resetInteractions(idOrSlug, options = {}) {
      return mutate("progress.reset", { idOrSlug }, options, async (tx) => {
        const setId = idOrSlug ? (await tx.requireSet(idOrSlug)).id : null;
        for (const item of await tx.list(namespaces.progress)) {
          if (!setId || setId === item.setId) {
            await tx.write(
              namespaces.progress,
              progressKey(item.setId, item.cardId),
              null,
            );
          }
        }
        return { interactionsBySet: await tx.getInteractions() };
      });
    },
    setFavorites(input, options = {}) {
      return mutate("favorites.set", { input }, options, async (tx) => {
        const favorites = await tx.validFavorites(input);
        await tx.write(namespaces.favorites, "all", favorites);
        return { favorites };
      });
    },
    undoChange(id, options = {}) {
      return mutate("library.undo", { id }, options, (tx) => undo(tx, id));
    },
    undoLastChange(options = {}) {
      return mutate("library.undo", { latest: true }, options, async (tx) => {
        const last = await tx.one(
          "SELECT id FROM lumina_mutations WHERE undone_at IS NULL AND action != 'library.undo' AND patches != '[]' ORDER BY revision DESC LIMIT 1",
        );
        return last ? undo(tx, last.id) : { undone: false };
      });
    },
    async hasUndoableChange() {
      return Boolean(
        await reads.one(
          "SELECT id FROM lumina_mutations WHERE undone_at IS NULL AND action != 'library.undo' AND patches != '[]' LIMIT 1",
        ),
      );
    },
    async listChanges() {
      return (
        await reads.rows(
          "SELECT id, revision, action, label, created_at, undone_at FROM lumina_mutations ORDER BY revision DESC",
        )
      ).map((row) => ({
        mutationId: row.id,
        revision: row.revision,
        action: row.action,
        label: row.label,
        createdAt: row.created_at,
        undoneAt: row.undone_at,
      }));
    },
    importBrowserData(input, options = {}) {
      const { originId, records, interactionsBySet, favorites } = z
        .object({
          originId: identifier,
          records: z.array(z.unknown()).default([]),
          interactionsBySet: z.record(z.string(), z.unknown()).default({}),
          favorites: z.array(favoriteSchema).default([]),
        })
        .parse(input);
      return mutate(
        "library.import_browser",
        { originId, records, interactionsBySet, favorites },
        options,
        async (tx) => {
          const imported = await tx.read(namespaces.imports, originId);
          if (imported) {
            return { ...imported, alreadyImported: true };
          }
          const slugMap = {};
          let created = 0;
          for (const candidate of records) {
            const rawSet = normalizeSet(candidate.rawSet || candidate);
            const originalSlug =
              candidate.slug || slugify(`${rawSet.category}/${rawSet.title}`);
            const matching = (await tx.listStudySets()).find(
              (record) => serialize(record.rawSet) === serialize(rawSet),
            );
            const record =
              matching ||
              (await tx.insertSet(rawSet, {
                slug: originalSlug,
                source: candidate.source || { type: "imported" },
                importedAt: candidate.importedAt,
              }));
            if (!matching) {
              created++;
            }
            slugMap[originalSlug] = record.slug;
            const progress = interactionsBySet[originalSlug];
            if (
              progress &&
              typeof progress === "object" &&
              !Array.isArray(progress)
            ) {
              for (const [cardId, patch] of Object.entries(progress)) {
                if (
                  !record.rawSet.cards.some(
                    (card) => card.id === Number(cardId),
                  )
                ) {
                  continue;
                }
                if (
                  await tx.read(
                    namespaces.progress,
                    progressKey(record.id, Number(cardId)),
                  )
                ) {
                  continue;
                }
                try {
                  await tx.setProgress(record, cardId, patch, false);
                } catch (error) {
                  if (!(error instanceof z.ZodError) && error.status !== 400) {
                    throw error;
                  }
                }
              }
            }
          }
          const mappedFavorites = favorites.map((item) =>
            item.type === "set"
              ? { ...item, slug: slugMap[item.slug] || item.slug }
              : item,
          );
          await tx.write(
            namespaces.favorites,
            "all",
            await tx.validFavorites([
              ...(await tx.getFavorites()),
              ...mappedFavorites,
            ]),
          );
          const receipt = { originId, created, slugMap };
          await tx.write(namespaces.imports, originId, receipt);
          return {
            ...receipt,
            records: await tx.listStudySets(),
            interactionsBySet: await tx.getInteractions(),
            favorites: await tx.getFavorites(),
          };
        },
      );
    },
    getRecord(namespace, id) {
      return reads.read(identifier.parse(namespace), identifier.parse(id));
    },
    listRecords(namespace) {
      return reads.list(identifier.parse(namespace));
    },
    putRecord(namespace, id, value) {
      return store.updateRecord(namespace, id, () => value);
    },
    updateRecord(namespace, id, updater) {
      checkNamespace(namespace, id);
      return transaction(async (tx) => {
        const previous = await tx.read(namespace, id);
        const next = await updater(previous);
        if (next === undefined) {
          return previous;
        }
        await tx.write(namespace, id, next);
        return next;
      });
    },
    deleteRecord(namespace, id) {
      checkNamespace(namespace, id);
      return transaction(async (tx) => {
        const exists = (await tx.raw(namespace, id)) !== null;
        await tx.write(namespace, id, null);
        return exists;
      });
    },
  };
  return store;
}
