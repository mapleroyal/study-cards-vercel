import { Router } from "express";

function progressIdentity(body) {
  if (typeof body?.setId !== "string" || !body.setId.trim()) {
    throw Object.assign(
      new Error(
        "A pending answer from an older app version needs review. Your draft remains saved on this device.",
      ),
      { status: 428 },
    );
  }
  return { setId: body.setId };
}

export function createLibraryRouter({ store }) {
  const router = Router();
  router.get("/library", async (_req, res) => {
    const { records, revision } = await store.snapshot();
    res.json({ records, revision });
  });
  router.get("/library/:id", async (req, res) => {
    const record = await store.getStudySet(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Study set not found." });
    }
    return res.json({ record });
  });
  router.get("/progress", async (_req, res) => {
    const { interactionsBySet, revision } = await store.snapshot();
    res.json({ interactionsBySet, revision });
  });
  router.patch("/progress", async (req, res) => {
    const { slug, cardId, patch, mutationId, cardVersion } = req.body ?? {};
    res.json(
      await store.setInteraction(slug, cardId, patch, {
        mutationId,
        ...progressIdentity(req.body),
        cardVersion,
        replace: true,
      }),
    );
  });
  router.get("/favorites", async (_req, res) => {
    const { favorites, revision } = await store.snapshot();
    res.json({ favorites, revision });
  });
  router.put("/favorites", async (req, res) => {
    res.json(
      await store.setFavorites(req.body.favorites, {
        mutationId: req.body.mutationId,
      }),
    );
  });
  router.post("/actions", async (req, res) => {
    const {
      action,
      args: suppliedArgs,
      mutationId,
      expectedRevision,
    } = req.body ?? {};
    const args = suppliedArgs ?? {};
    const options = { mutationId, expectedRevision };
    let result;
    switch (action) {
      case "study_set.create":
        result = await store.createStudySet(args.rawSet, {
          ...options,
          source: args.source,
        });
        break;
      case "study_set.update":
        result = await store.updateStudySet(args.id, args.patch, options);
        break;
      case "study_set.delete":
        result = await store.deleteStudySet(args.id, options);
        break;
      case "library.undo":
        result = args.mutationId
          ? await store.undoChange(args.mutationId, options)
          : await store.undoLastChange(options);
        break;
      case "library.import_browser":
        result = await store.importBrowserData(args, options);
        break;
      case "progress.set":
        result = await store.setInteraction(
          args.slug,
          args.cardId,
          args.patch,
          {
            ...options,
            ...progressIdentity(args),
            cardVersion: args.cardVersion,
          },
        );
        break;
      case "progress.reset":
        result = await store.resetInteractions(args.slug, options);
        break;
      case "favorites.set":
        result = await store.setFavorites(args.favorites, options);
        break;
      default:
        return res.status(400).json({ error: "Unknown application action." });
    }
    return res.json(result);
  });
  return router;
}
