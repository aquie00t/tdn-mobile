import { useCallback, useState } from "react";

import type { Comment } from "../../data/comment.types";
import { commentApi } from "../../data/comment.api";
import { commentUrl } from "@shared/utils/web-url";
import { getErrorMessage } from "@shared/utils/error-handler";
import { shareLink } from "@shared/utils/share";
import { useCommentOverlayStore } from "../store/comment-overlay.store";
import { useI18n } from "@shared/hooks/useI18n";
import { useToastStore } from "@shared/store/toast.store";

export interface UseCommentActionsOptions {
    comment: Comment;
}

/**
 * Liking, saving and sharing one comment — the post's three, on a smaller row.
 *
 * The state lives in the overlay store rather than here, for the reasons
 * `create-overlay-store` sets out: a thread is a virtualised list, and a
 * comment can be on screen twice at once when it is also a reply expanded
 * under its parent.
 *
 * Deleting is deliberately absent. It needs a confirm, the `Modal` primitive
 * is not written, and a destructive action behind a single unguarded tap is
 * worse than one that is not there yet.
 */
export function useCommentActions({ comment }: UseCommentActionsOptions) {
    const { t } = useI18n();
    const addToast = useToastStore((s) => s.addToast);
    const patch = useCommentOverlayStore((s) => s.patch);

    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

    const handleLike = useCallback(async () => {
        if (isLikeLoading) return;

        const wasLiked = comment.isLiked;
        const previousCount = comment.likeCount;

        setIsLikeLoading(true);
        patch(comment.id, {
            isLiked: !wasLiked,
            likeCount: wasLiked ? previousCount - 1 : previousCount + 1,
        });

        try {
            if (wasLiked) await commentApi.unlikeComment(comment.id);
            else await commentApi.likeComment(comment.id);
        } catch (err) {
            patch(comment.id, {
                isLiked: wasLiked,
                likeCount: previousCount,
            });
            addToast({ type: "error", message: getErrorMessage(err) });
        } finally {
            setIsLikeLoading(false);
        }
    }, [
        comment.id,
        comment.isLiked,
        comment.likeCount,
        isLikeLoading,
        patch,
        addToast,
    ]);

    const handleBookmark = useCallback(async () => {
        if (isBookmarkLoading) return;

        const wasBookmarked = comment.isBookmarked;

        setIsBookmarkLoading(true);
        patch(comment.id, { isBookmarked: !wasBookmarked });

        try {
            if (wasBookmarked) await commentApi.unsaveComment(comment.id);
            else await commentApi.saveComment(comment.id);
        } catch (err) {
            patch(comment.id, { isBookmarked: wasBookmarked });
            addToast({ type: "error", message: getErrorMessage(err) });
        } finally {
            setIsBookmarkLoading(false);
        }
    }, [comment.id, comment.isBookmarked, isBookmarkLoading, patch, addToast]);

    const handleShare = useCallback(async () => {
        const outcome = await shareLink(
            t("comment.shareText"),
            commentUrl(comment.id),
        );

        if (outcome === "error") {
            addToast({ type: "error", message: t("common.shareFailed") });
        }
    }, [comment.id, t, addToast]);

    return {
        handleLike,
        isLikeLoading,
        handleBookmark,
        isBookmarkLoading,
        handleShare,
    };
}
