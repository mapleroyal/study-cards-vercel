import { afterEach, describe, expect, it, vi } from "vitest";
import { createOwnerSettings } from "./settings.mjs";
import { DEFAULT_SELECTION } from "./models.mjs";
import { createTestModelCatalog } from "./test-helpers/models.mjs";
import { createTestStore } from "./test-helpers/store.mjs";

const stores = [];
function fixture(overrides = {}) {
  const store = createTestStore();
  stores.push(store);
  const seal = vi.fn(async (key) => `sealed:${key}`);
  const unseal = vi.fn(async (value) => value.slice(7));
  const settings = createOwnerSettings({
    store,
    models: createTestModelCatalog(),
    env: {},
    seal,
    unseal,
    ...overrides,
  });
  return { store, settings, seal, unseal };
}
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

describe("owner model preferences", () => {
  it("defaults to Haiku 5.5 high, persists choice across service instances and returns no secret material", async () => {
    const { store, settings, unseal } = fixture();
    expect(await settings.read()).toEqual({
      ...DEFAULT_SELECTION,
      openRouterConfigured: false,
    });
    const connected = await settings.update({
      openRouterKey: "sk-or-fixture-only",
    });
    expect(connected).toEqual({
      ...DEFAULT_SELECTION,
      openRouterConfigured: true,
    });
    expect(unseal).not.toHaveBeenCalled();
    await settings.update({ model: "fixture/plain-text", reasoningEffort: "" });
    const nextInstance = createOwnerSettings({
      store,
      models: createTestModelCatalog(),
      env: {},
      unseal,
    });
    expect(await nextInstance.read()).toEqual({
      model: "fixture/plain-text",
      reasoningEffort: "",
      openRouterConfigured: true,
    });
    expect(await nextInstance.getApiKey()).toBe("sk-or-fixture-only");
    expect(await store.getRecord("settings", "owner")).toMatchObject({
      openRouterKey: "sealed:sk-or-fixture-only",
    });
  });

  it("preserves an explicitly saved Sonnet/xhigh preference when the application default changes", async () => {
    const { store, settings } = fixture();
    const previous = {
      model: "anthropic/claude-sonnet-5.5",
      reasoningEffort: "xhigh",
      openRouterKey: "sealed:sk-or-existing-fixture",
    };
    await store.putRecord("settings", "owner", previous);
    expect(await settings.getSelection()).toEqual({
      model: previous.model,
      reasoningEffort: previous.reasoningEffort,
    });
    expect(await settings.read()).toEqual({
      model: previous.model,
      reasoningEffort: previous.reasoningEffort,
      openRouterConfigured: true,
    });
    expect(await store.getRecord("settings", "owner")).toEqual(previous);
  });

  it("preserves concurrent model and key patches under the database transaction", async () => {
    let releaseSeal;
    let startedSeal;
    const sealing = new Promise((resolve) => {
      startedSeal = resolve;
    });
    const { store, settings } = fixture({
      seal: (key) => {
        startedSeal();
        return new Promise((resolve) => {
          releaseSeal = () => resolve(`sealed:${key}`);
        });
      },
    });
    const keySave = settings.update({ openRouterKey: "sk-or-fixture-new" });
    await sealing;
    await settings.update({ model: "fixture/plain-text", reasoningEffort: "" });
    releaseSeal();
    await keySave;
    expect(await settings.read()).toEqual({
      model: "fixture/plain-text",
      reasoningEffort: "",
      openRouterConfigured: true,
    });
    expect((await store.getRecord("settings", "owner")).openRouterKey).toBe(
      "sealed:sk-or-fixture-new",
    );
    await settings.update({
      model: DEFAULT_SELECTION.model,
      reasoningEffort: "max",
    });
    expect(await settings.read()).toEqual({
      model: DEFAULT_SELECTION.model,
      reasoningEffort: "max",
      openRouterConfigured: true,
    });
    expect((await store.getRecord("settings", "owner")).openRouterKey).toBe(
      "sealed:sk-or-fixture-new",
    );
  });

  it("applies partial effort changes to the current model and rejects unsupported selections without altering the key", async () => {
    const { settings, store } = fixture();
    await settings.update({
      openRouterKey: "sk-or-fixture-only",
      reasoningEffort: "max",
    });
    const previous = await store.getRecord("settings", "owner");
    await expect(
      settings.update({ reasoningEffort: "minimal", openRouterKey: "" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(settings.update({ model: "missing" })).rejects.toMatchObject({
      status: 422,
    });
    expect(await store.getRecord("settings", "owner")).toEqual(previous);
    await settings.update({ model: "fixture/plain-text" });
    expect(await settings.getSelection()).toEqual({
      model: "fixture/plain-text",
      reasoningEffort: "",
    });
    await settings.update({ openRouterKey: "" });
    expect(await settings.read()).toEqual({
      model: "fixture/plain-text",
      reasoningEffort: "",
      openRouterConfigured: false,
    });
  });

  it("removes the encrypted key without changing the owner's other preferences", async () => {
    const { settings, store, seal, unseal } = fixture();
    await settings.update({
      openRouterKey: "sk-or-fixture-added",
      model: DEFAULT_SELECTION.model,
      reasoningEffort: "max",
    });
    const previous = await store.getRecord("settings", "owner");
    const removed = await settings.update({ openRouterKey: "" });
    expect(removed).toEqual({
      model: DEFAULT_SELECTION.model,
      reasoningEffort: "max",
      openRouterConfigured: false,
    });
    expect(await store.getRecord("settings", "owner")).toEqual({
      ...previous,
      openRouterKey: null,
    });
    expect(await settings.getApiKey()).toBeNull();
    expect(seal).toHaveBeenCalledTimes(1);
    expect(unseal).not.toHaveBeenCalled();
  });

  it("keeps explicit removal disconnected from an environment fallback through model changes and reload, and permits adding a new key", async () => {
    const env = { OPENROUTER_API_KEY: "sk-or-fixture-environment" };
    const { settings, store, unseal } = fixture({ env });
    expect((await settings.read()).openRouterConfigured).toBe(true);
    expect(await settings.getApiKey()).toBe(env.OPENROUTER_API_KEY);
    await settings.update({ model: "fixture/plain-text" });
    expect(await settings.getApiKey()).toBe(env.OPENROUTER_API_KEY);
    await settings.update({ openRouterKey: "" });
    expect((await settings.read()).openRouterConfigured).toBe(false);
    expect(await settings.getApiKey()).toBeNull();
    await settings.update({ ...DEFAULT_SELECTION });
    expect(
      (await store.getRecord("settings", "owner")).openRouterKey,
    ).toBeNull();
    const reloaded = createOwnerSettings({
      store,
      models: createTestModelCatalog(),
      env,
      unseal,
    });
    expect(await reloaded.read()).toEqual({
      ...DEFAULT_SELECTION,
      openRouterConfigured: false,
    });
    expect(await reloaded.getApiKey()).toBeNull();
    expect(unseal).not.toHaveBeenCalled();
    await settings.update({ openRouterKey: "sk-or-fixture-readded" });
    expect((await reloaded.read()).openRouterConfigured).toBe(true);
    expect(await reloaded.getApiKey()).toBe("sk-or-fixture-readded");
    expect(env.OPENROUTER_API_KEY).toBe("sk-or-fixture-environment");
  });

  it("does not require model network access for key-only changes", async () => {
    const models = {
      list: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    const { settings } = fixture({ models });
    expect(
      await settings.update({ openRouterKey: "sk-or-fixture-only" }),
    ).toEqual({ ...DEFAULT_SELECTION, openRouterConfigured: true });
    expect(
      (await settings.update({ openRouterKey: "" })).openRouterConfigured,
    ).toBe(false);
    expect(models.list).not.toHaveBeenCalled();
  });
});
