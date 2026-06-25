"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDrafts } from "@/app/lib/hooks/useDrafts";
import { Draft } from "@/app/lib/types/draft";
import { Button } from "@/app/components/ui/button";
import { Modal } from "@/app/components/ui/modal";
import { ConfirmDialog } from "@/app/components/admin/ConfirmDialog";
import { useGlobalToast } from "@/app/components/common/Toast";
import { Trash2, Clock, FileText, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, X } from "lucide-react";
import { formatDate } from "@/app/lib/utils/formatDate";
import { Gender } from "@/app/lib/utils/validation";
import { cn } from "@/app/lib/utils/cn";

interface DraftManagerProps {
  currentDraft: {
    title?: string;
    body: string;
    gender?: string;
  };
  onLoadDraft: (draft: Draft) => void;
  autoSaveInterval?: number; // in milliseconds
}

type ConflictResolution = "keep-local" | "use-server" | "discard";

interface DraftConflict {
  localDraft: Draft;
  serverDraft: Draft;
  onResolve: (resolution: ConflictResolution) => void;
}

export const DraftManager: React.FC<DraftManagerProps> = ({
  currentDraft,
  onLoadDraft,
  autoSaveInterval = 3000, // 3s, per acceptance criteria ("within 3s of typing stop")
}) => {
  const {
    drafts,
    isLoading,
    error: draftsError,
    isRemote,
    saveDraft,
    updateDraft,
    deleteDraft,
    clearDrafts,
    loadDraft,
  } = useDrafts();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [clearDraftsOpen, setClearDraftsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "unsaved" | "failed"
  >("saved");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DraftConflict | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>("");
  const toast = useGlobalToast();

  // Restore most recent draft on mount if one exists and the composer is empty.
  // Acceptance criteria: "Restore draft on composer mount when user has
  // saved drafts."
  const didAttemptRestoreRef = useRef(false);
  useEffect(() => {
    if (didAttemptRestoreRef.current) return;
    if (isLoading) return; // wait for remote drafts to load before deciding
    didAttemptRestoreRef.current = true;

    if (!currentDraft.body.trim().length && drafts.length > 0) {
      const mostRecent = drafts[0];
      onLoadDraft(mostRecent);
      setCurrentDraftId(mostRecent.id);
      lastSavedRef.current = JSON.stringify({
        title: mostRecent.title,
        body: mostRecent.body,
        gender: mostRecent.gender,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, drafts]);

  useEffect(() => {
    if (currentDraftId && !loadDraft(currentDraftId)) {
      setCurrentDraftId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  /**
   * Detect conflict: when the user loads a draft from the list, check if the
   * current composer content differs from both the selected draft AND the
   * latest server version. If so, surface a conflict resolution UI.
   */
  const detectConflict = useCallback(
    (selectedDraft: Draft) => {
      // Find the latest server version of this draft
      const serverVersion = drafts.find((d) => d.id === selectedDraft.id);
      if (!serverVersion) return false;

      // Check if server has a newer version than what we selected
      const serverIsNewer = serverVersion.savedAt > selectedDraft.savedAt;
      if (!serverIsNewer) return false;

      // Check if local composer content differs from server
      const localContent = JSON.stringify({
        title: currentDraft.title,
        body: currentDraft.body,
        gender: currentDraft.gender,
      });
      const serverContent = JSON.stringify({
        title: serverVersion.title,
        body: serverVersion.body,
        gender: serverVersion.gender,
      });

      return localContent !== serverContent;
    },
    [drafts, currentDraft]
  );

  const persistDraft = async () => {
    const currentContent = JSON.stringify(currentDraft);
    if (currentContent === lastSavedRef.current) {
      return true;
    }

    if (!currentDraft.body.trim().length) {
      setSaveStatus("saved");
      setSaveMessage(null);
      lastSavedRef.current = currentContent;
      return true;
    }

    const draftToSave = {
      title: currentDraft.title,
      body: currentDraft.body,
      gender: currentDraft.gender as Gender | undefined,
    };

    setSaveStatus("saving");
    setSaveMessage("Saving draft...");

    const existingDraft = currentDraftId ? loadDraft(currentDraftId) : null;
    let success = false;

    try {
      if (existingDraft && currentDraftId) {
        success = await updateDraft(currentDraftId, draftToSave);
      } else {
        if (currentDraftId) {
          setCurrentDraftId(null);
        }
        const newDraftId = await saveDraft(draftToSave);
        if (newDraftId) {
          setCurrentDraftId(newDraftId);
          success = true;
        }
      }
    } catch {
      success = false;
    }

    if (success) {
      setSaveStatus("saved");
      setSaveMessage("Draft saved.");
      lastSavedRef.current = currentContent;
      return true;
    }

    setSaveStatus("failed");
    setSaveMessage(
      draftsError ??
        (isRemote
          ? "Failed to save draft. Check your connection and retry."
          : "Failed to save draft."),
    );
    return false;
  };

  useEffect(() => {
    const currentContent = JSON.stringify(currentDraft);

    if (currentContent !== lastSavedRef.current) {
      setSaveStatus("unsaved");
      setSaveMessage("Unsaved changes");
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistDraft();
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraft, autoSaveInterval, currentDraftId]);

  const handleLoadDraft = (draft: Draft) => {
    // Check for conflict before loading
    if (detectConflict(draft)) {
      const serverVersion = drafts.find((d) => d.id === draft.id);
      if (serverVersion) {
        setConflict({
          localDraft: draft,
          serverDraft: serverVersion,
          onResolve: (resolution) => {
            setConflict(null);
            switch (resolution) {
              case "keep-local":
                // Keep current composer content, do nothing
                setIsModalOpen(false);
                break;
              case "use-server":
                // Load the server version
                onLoadDraft(serverVersion);
                setCurrentDraftId(serverVersion.id);
                lastSavedRef.current = JSON.stringify({
                  title: serverVersion.title,
                  body: serverVersion.body,
                  gender: serverVersion.gender,
                });
                setSaveStatus("saved");
                setSaveMessage("Draft saved.");
                setIsModalOpen(false);
                break;
              case "discard":
                // Load the originally selected draft
                onLoadDraft(draft);
                setCurrentDraftId(draft.id);
                lastSavedRef.current = JSON.stringify({
                  title: draft.title,
                  body: draft.body,
                  gender: draft.gender,
                });
                setSaveStatus("saved");
                setSaveMessage("Draft saved.");
                setIsModalOpen(false);
                break;
            }
          },
        });
        return;
      }
    }

    onLoadDraft(draft);
    setCurrentDraftId(draft.id);
    lastSavedRef.current = JSON.stringify({
      title: draft.title,
      body: draft.body,
      gender: draft.gender,
    });
    setSaveStatus("saved");
    setSaveMessage("Draft saved.");
    setIsModalOpen(false);
  };

  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void deleteDraft(id);
    if (currentDraftId === id) {
      setCurrentDraftId(null);
    }
  };

  const handleClearDrafts = async () => {
    await clearDrafts();
    setCurrentDraftId(null);
    setClearDraftsOpen(false);
    toast.success("All drafts cleared.");
  };

  /**
   * Called by the composer on successful publish/submit, per acceptance
   * criteria: "Publishing or submitting clears or archives draft per
   * product rules."
   */
  const handlePublishCleanup = async () => {
    if (currentDraftId) {
      await deleteDraft(currentDraftId);
      setCurrentDraftId(null);
      lastSavedRef.current = "";
      setSaveStatus("saved");
      setSaveMessage(null);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={clearDraftsOpen}
        onOpenChange={setClearDraftsOpen}
        title="Clear all drafts?"
        description="This will permanently remove every saved draft on this device."
        confirmLabel="Clear drafts"
        variant="danger"
        onConfirm={() => void handleClearDrafts()}
      />

      {/* Conflict Resolution Modal */}
      {conflict && (
        <Modal
          isOpen={true}
          onClose={() => setConflict(null)}
          title="Draft Conflict Detected"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-300">
                  This draft has been updated since you last loaded it
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Choose which version to keep. Your current composer content differs from the server version.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {/* Keep Local */}
              <button
                type="button"
                onClick={() => conflict.onResolve("keep-local")}
                className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-left hover:border-blue-500/50 hover:bg-zinc-700 transition-colors"
              >
                <ArrowUpFromLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-white">Keep my current edits</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Preserve what you have in the composer right now
                  </p>
                </div>
              </button>

              {/* Use Server */}
              <button
                type="button"
                onClick={() => conflict.onResolve("use-server")}
                className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-left hover:border-green-500/50 hover:bg-zinc-700 transition-colors"
              >
                <ArrowDownToLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                <div>
                  <p className="text-sm font-medium text-white">Use server version</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Load the latest saved version from the server
                    <span className="text-zinc-500">
                      {" "}({formatDate(new Date(conflict.serverDraft.savedAt))})
                    </span>
                  </p>
                </div>
              </button>

              {/* Discard / Load Selected */}
              <button
                type="button"
                onClick={() => conflict.onResolve("discard")}
                className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-left hover:border-purple-500/50 hover:bg-zinc-700 transition-colors"
              >
                <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-white">Load selected draft</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Load the draft you originally selected
                    <span className="text-zinc-500">
                      {" "}({formatDate(new Date(conflict.localDraft.savedAt))})
                    </span>
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConflict(null)}
              >
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          aria-label="Manage drafts"
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Drafts</span>
          {drafts.length > 0 && (
            <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs">
              {drafts.length}
            </span>
          )}
        </Button>

        <div className="text-xs text-zinc-400">
          {saveStatus === "saved" && saveMessage && <span>{saveMessage}</span>}
          {saveStatus === "unsaved" && (
            <span className="text-amber-300">Unsaved changes</span>
          )}
          {saveStatus === "saving" && <span>Saving draft…</span>}
          {saveStatus === "failed" && (
            <span className="text-rose-300">
              {saveMessage ?? "Failed to save draft."}{" "}
              <button
                type="button"
                onClick={() => void persistDraft()}
                className="underline"
              >
                Retry
              </button>
            </span>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Saved Drafts"
      >
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-center text-zinc-400 py-8">
              Loading your drafts…
            </p>
          ) : drafts.length === 0 ? (
            <p className="text-center text-zinc-400 py-8">
              No saved drafts yet. Your drafts will be auto-saved every few
              seconds.
            </p>
          ) : (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:bg-zinc-800 transition-colors cursor-pointer",
                      currentDraftId === draft.id && "border-blue-500/50 bg-zinc-800"
                    )}
                    onClick={() => handleLoadDraft(draft)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleLoadDraft(draft);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      {draft.title && (
                        <h4 className="font-medium text-white mb-1 truncate">
                          {draft.title}
                        </h4>
                      )}
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-2">
                        {draft.body}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(new Date(draft.savedAt))}
                        </span>
                        <span>{draft.characterCount} characters</span>
                        {isRemote && (
                          <span className="flex items-center gap-1 text-blue-400">
                            <ArrowDownToLine className="h-3 w-3" />
                            Synced
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteDraft(draft.id, e)}
                      aria-label={`Delete draft from ${formatDate(new Date(draft.savedAt))}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-4 border-t border-zinc-800">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setClearDraftsOpen(true)}
                >
                  Clear All Drafts
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};
