import { useCallback, useState } from "react";

import type { Comment } from "../../data/comment.types";
import { commentApi } from "../../data/comment.api";
import { commentUrl } from "@shared/utils/web-url";
import { reportError } from "@shared/utils/report-error";
import { shareLink } from "@shared/utils/share";
import { useCommentOverlayStore } from "../store/comment-overlay.store";
import { useDeletedContentStore } from "@shared/store/deleted-content.store";
import { isNotFound } from "@shared/utils/error-handler";
import { useI18n } from "@shared/hooks/useI18n";

export interface UseCommentActionsOptions {
    comment: Comment;
    /**
     * Told once a delete has landed, so the screen above can move the count
     * of whatever the comment hung off. After the server answers rather than
     * with the optimistic step: a count is not worth a rollback of its own.
     */
    onDeleted?: (comment: Comment) => void;
}

/**
 * Liking, saving and sharing one comment — the post's three, on a smaller row.
 *
 * The state lives in the overlay store rather than here, for the reasons
 * `create-overlay-store` sets out: a thread is a virtualised list, and a
 * comment can be on screen twice at once when it is also a reply expanded
 * under its parent.
 *
 * A failure rolls back and says nothing, as on a post; the reason goes to
 * `reportError`.
 *
 * Deleting is deliberately absent. It needs a confirm, and a destructive
 * action behind a single unguarded tap is worse than one that is not there
 * yet.
 */
export function useCommentActions({
    comment,
    onDeleted,
}: UseCommentActionsOptions) {
    const { t } = useI18n();
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
            reportError("comment.like", err);
        } finally {
            setIsLikeLoading(false);
        }
    }, [comment.id, comment.isLiked, comment.likeCount, isLikeLoading, patch]);

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
            reportError("comment.bookmark", err);
        } finally {
            setIsBookmarkLoading(false);
        }
    }, [comment.id, comment.isBookmarked, isBookmarkLoading, patch]);

    const handleShare = useCallback(async () => {
        const outcome = await shareLink(
            t("comment.shareText"),
            commentUrl(comment.id),
        );

        if (outcome === "error") {
            reportError("comment.share", "The share sheet did not open.");
        }
    }, [comment.id, t]);

    const markDeleted = useDeletedContentStore((s) => s.markComment);
    const unmarkDeleted = useDeletedContentStore((s) => s.unmarkComment);

    /** As a post's: marked at once, unmarked on failure. */
    const handleDelete = useCallback(async () => {
        markDeleted(comment.id);

        try {
            await commentApi.deleteComment(comment.id);
            onDeleted?.(comment);
        } catch (err) {
            if (isNotFound(err)) return;
            unmarkDeleted(comment.id);
            reportError("comment.delete", err);
        }
    }, [comment, markDeleted, unmarkDeleted, onDeleted]);

    return {
        handleLike,
        isLikeLoading,
        handleBookmark,
        isBookmarkLoading,
        handleShare,
        handleDelete,
    };
}
