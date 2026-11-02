import { useCapabilities } from "@/lib/runtime-client";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";
import { useNavigate } from "react-router";
import { toast } from "@/components/ui/toast";
import {
  performLibraryAction,
  undoLibraryAction,
} from "@/lib/runtime-study-set-storage";
import {
  flushRuntimeSync,
  refreshRuntimeState,
  getRuntimeSyncSnapshot,
} from "@/lib/runtime-sync";
import { selectFirstLocalSet } from "@/lib/study-sets";
import { useStudySetsStore } from "@/stores/use-study-sets-store";

async function requireSynchronizedProgress(message) {
  await flushRuntimeSync();
  if (getRuntimeSyncSnapshot().pending) {
    throw new Error(message);
  }
}

export function useStudyLibraryActions(activeSlug) {
  const navigate = useNavigate();
  const capabilities = useCapabilities();
  const deleteStudySet = useStudySetsStore((state) => state.deleteStudySet);
  async function deleteSet(slug) {
    try {
      let receipt;
      const nextRecords = await deleteStudySet(slug, {
        onDeleted: (result) => {
          receipt = result;
        },
      });
      if (capabilities?.server && receipt?.mutationId) {
        const mutationId = receipt.mutationId;
        toast.add({
          title: "Set deleted",
          type: "success",
          actionProps: {
            children: "Undo",
            onClick: async () => {
              try {
                await undoLibraryAction(mutationId);
                await useStudySetsStore.getState().load();
              } catch (error) {
                toast.add({ title: error.message, type: "error" });
              }
            },
          },
        });
      }
      if (activeSlug === slug) {
        const nextSet = selectFirstLocalSet(nextRecords);
        navigate(nextSet ? `/sets/${nextSet.slug}` : "/");
      }
    } catch (error) {
      toast.add({ title: error.message, type: "error" });
    }
  }
  async function resetSet(slug) {
    if (!capabilities?.server) {
      useStudyInteractionsStore.getState().resetSet(slug);
      return;
    }
    try {
      await requireSynchronizedProgress("Reconnect to reset progress.");
      const result = await performLibraryAction("progress.reset", { slug });
      await refreshRuntimeState();
      toast.add({
        title: "Progress reset",
        type: "success",
        actionProps: {
          children: "Undo",
          onClick: async () => {
            try {
              await requireSynchronizedProgress(
                "Reconnect to undo this change.",
              );
              await undoLibraryAction(result.mutationId);
              await refreshRuntimeState();
            } catch (error) {
              toast.add({ title: error.message, type: "error" });
            }
          },
        },
      });
    } catch (error) {
      toast.add({ title: error.message, type: "error" });
    }
  }
  return { deleteSet, resetSet };
}
