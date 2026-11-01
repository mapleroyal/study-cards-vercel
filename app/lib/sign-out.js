import { deleteDB } from "idb";
import { apiRequest } from "@/lib/runtime-client";
import {
  flushRuntimeSyncForSignOut,
  readPendingRuntimeChanges,
  stopRuntimeSyncForSignOut,
} from "@/lib/runtime-sync";
import { closeStudySetCache } from "@/lib/runtime-study-set-storage";
import { closeLocalStudySetDatabase } from "@/lib/local-study-set-storage";

let signingOut;
export function signOut({ discardUnsynced = false } = {}) {
  if (!signingOut) {
    const run = () => completeSignOut(discardUnsynced);
    const locks = globalThis.navigator?.locks;
    signingOut = (
      locks ? locks.request("lumina-sign-out", run) : run()
    ).finally(() => {
      signingOut = undefined;
    });
  }
  return signingOut;
}

async function completeSignOut(discardUnsynced) {
  if (!discardUnsynced) {
    await flushRuntimeSyncForSignOut();
  }
  await apiRequest("/api/session", { method: "DELETE" });
  globalThis.localStorage.setItem("lumina:sign-out", String(Date.now()));
  await stopRuntimeSyncForSignOut();
  await Promise.all([closeStudySetCache(), closeLocalStudySetDatabase()]);
  const registrations =
    (await globalThis.navigator.serviceWorker?.getRegistrations()) || [];
  await Promise.all(
    registrations.map((registration) => registration.unregister()),
  );
  const databases = (await globalThis.indexedDB.databases?.()) || [
    { name: "lumina-sync" },
    { name: "lumina-server-cache" },
    { name: "lumina:study-sets" },
  ];
  await Promise.all(
    databases
      .filter((database) => database.name?.startsWith("lumina"))
      .map((database) => deleteDB(database.name)),
  );
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  if (globalThis.caches) {
    await Promise.all(
      (await globalThis.caches.keys()).map((name) =>
        globalThis.caches.delete(name),
      ),
    );
  }
  globalThis.location.replace("/login");
}

export async function downloadUnsyncedChanges() {
  const recovery = await readPendingRuntimeChanges();
  const url = URL.createObjectURL(
    new globalThis.Blob([`${JSON.stringify(recovery, null, 2)}\n`], {
      type: "application/json;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "study-cards-unsynced-changes.json";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
