import express from "express";
import { afterEach, expect, it } from "vitest";
import { createLibraryRouter } from "./library.mjs";
import { createTestStore } from "./test-helpers/store.mjs";

const resources = [];
afterEach(async () => {
  for (const { server, store } of resources.splice(0)) {
    await new Promise((resolve) => server.close(resolve));
    await store.close();
  }
});
async function app() {
  const store = createTestStore();
  const application = express();
  application.use(express.json());
  application.use("/api", createLibraryRouter({ store }));
  application.use((error, _req, res, _next) => {
    res.status(error.status || 400).json({ error: error.message });
  });
  const server = application.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  resources.push({ server, store });
  return async (path, body, method = body ? "POST" : "GET") => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api${path}`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: response.status, ...(await response.json()) };
  };
}

it("retains the browser library/progress/favorite mutation contract with persisted receipts", async () => {
  const request = await app();
  const create = {
    action: "study_set.create",
    mutationId: "client-create",
    args: {
      rawSet: {
        title: "Water",
        category: "Science",
        cards: [
          {
            id: 1,
            type: "true_false",
            question: "Water contains oxygen.",
            answer: true,
            explanation: "H2O contains one oxygen atom.",
          },
        ],
      },
    },
  };
  const first = await request("/actions", create);
  expect(first.status).toBe(200);
  expect(await request("/actions", create)).toEqual(first);
  const library = await request("/library");
  expect(library.records).toHaveLength(1);
  expect(library.revision).toBe(first.revision);
  const progress = await request(
    "/progress",
    {
      slug: first.record.slug,
      cardId: 1,
      patch: { selectedAnswer: true },
      cardVersion: JSON.stringify(first.record.rawSet.cards[0]),
      mutationId: "answer-1",
    },
    "PATCH",
  );
  expect(progress.patch).toEqual({ selectedAnswer: true });
  expect(
    (await request("/progress")).interactionsBySet[first.record.slug][1],
  ).toEqual({ selectedAnswer: true });
  await request(
    "/favorites",
    {
      favorites: [{ type: "set", slug: first.record.slug }],
      mutationId: "favorite-1",
    },
    "PUT",
  );
  expect((await request("/favorites")).favorites).toEqual([
    { type: "set", slug: first.record.slug },
  ]);
  const undo = await request("/actions", {
    action: "library.undo",
    args: { mutationId: "favorite-1" },
    mutationId: "undo-favorite",
  });
  expect(undo.undone).toBe(true);
  expect(undo.favorites).toEqual([]);
});

it("returns HTTP errors for invalid, absent and stale library actions", async () => {
  const request = await app();
  expect((await request("/library/missing")).status).toBe(404);
  expect((await request("/actions", { action: "unknown" })).status).toBe(400);
  expect(
    (
      await request("/actions", {
        action: "study_set.delete",
        args: { id: "missing" },
      })
    ).status,
  ).toBe(404);
});
