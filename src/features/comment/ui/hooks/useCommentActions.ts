import { useCallback, useState } from "react";

import type { Comment } from "../../data/comment.types";
import { commentApi } from "../../data/comment.api";
import { commentUrl } from "@shared/utils/web-url";
import { reportError } from "@shared/utils/report-error";
import { shareLink } from "@shared/utils/share";
import { useCommentOverlayStore } from "../store/comment-overlay.store";
import { useI18n } from "@shared/hooks/useI18n";

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
 * A failure rolls back and says nothing, as on a post; the reason goes to
 * `reportError`.
 *
 * Deleting is deliberately absent. It needs a confirm, and a destructive
 * action behind a single unguarded tap is worse than one that is not there
 * yet.
 */
export function useCommentActions({ comment }: UseCommentActionsOptions) {
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

    return {
        handleLike,
        isLikeLoading,
        handleBookmark,
        isBookmarkLoading,
        handleShare,
    };
}
