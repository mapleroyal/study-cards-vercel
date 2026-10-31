import * as React from "react";
import {
  getRuntimeSyncSnapshot,
  startRuntimeSync,
  subscribeRuntimeSync,
} from "@/lib/runtime-sync";

export function RuntimeSync() {
  const state = React.useSyncExternalStore(
    subscribeRuntimeSync,
    getRuntimeSyncSnapshot,
    getRuntimeSyncSnapshot,
  );
  React.useEffect(() => {
    let disposed = false;
    let stop;
    startRuntimeSync().then((cleanup) => {
      if (disposed) {
        cleanup();
      } else {
        stop = cleanup;
      }
    });
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  if (!state.offline && !state.error) {
    return null;
  }
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background px-4 py-2 text-center text-xs text-muted-foreground"
    >
      {state.error ||
        (state.pending
          ? "Offline · Your study progress will sync when you reconnect."
          : "Offline · Your saved cards are available.")}
    </div>
  );
}
