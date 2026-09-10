import { useCallback, useState } from "react";

import type { Comment } from "../../data/comment.types";
import { commentApi } from "../../data/comment.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { useCommentOverlayStore } from "../store/comment-overlay.store";
import { withOverlay } from "@shared/store/create-overlay-store";

interface CommentState {
    comment: Comment | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * One comment, read on its own — the head of its own thread.
 *
 * Shaped like `usePost`, and for the same reasons: fetched rather than handed
 * over, so a shared link opens; the reader's own changes laid over the answer,
 * so arriving here does not undo a like made a moment ago in the thread above;
 * and the screen calls `fetchComment` rather than the hook calling it, which
 * is how `useFeed` and `useComments` are shaped too.
 */
export function useComment(commentId: string) {
    const [state, setState] = useState<CommentState>({
        comment: null,
        isLoading: true,
        error: null,
    });
    const overlay = useCommentOverlayStore((s) => s.overlays[commentId]);

    const fetchComment = useCallback(async () => {
        try {
            const comment = await commentApi.getCommentById(commentId);
            setState({ comment, isLoading: false, error: null });
        } catch (err) {
            setState({
                comment: null,
                isLoading: false,
                error: getErrorMessage(err),
            });
        }
    }, [commentId]);

    const retry = useCallback(() => {
        setState({ comment: null, isLoading: true, error: null });
        void fetchComment();
    }, [fetchComment]);

    return {
        comment: state.comment ? withOverlay(state.comment, overlay) : null,
        isLoading: state.isLoading,
        error: state.error,
        fetchComment,
        retry,
    };
}
