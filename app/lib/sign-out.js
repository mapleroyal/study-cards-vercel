import { deleteDB } from "idb";
import { apiRequest } from "@/lib/runtime-client";
import { stopRuntimeSyncForSignOut } from "@/lib/runtime-sync";
import { closeStudySetCache } from "@/lib/runtime-study-set-storage";
import { closeLocalStudySetDatabase } from "@/lib/local-study-set-storage";

export async function signOut() {
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
