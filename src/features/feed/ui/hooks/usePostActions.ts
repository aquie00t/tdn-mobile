import { useCallback, useState } from "react";

import { feedApi } from "../../data/feed.api";
import type { Post } from "../../data/feed.types";
import { postUrl } from "@shared/utils/web-url";
import { reportError } from "@shared/utils/report-error";
import { shareLink } from "@shared/utils/share";
import { useI18n } from "@shared/hooks/useI18n";
import { usePostOverlayStore } from "../store/post-overlay.store";
import { useDeletedContentStore } from "@shared/store/deleted-content.store";
import { isNotFound } from "@shared/utils/error-handler";

export interface UsePostActionsOptions {
    post: Post;
}

/**
 * Liking, saving and sharing one post.
 *
 * **The state is the overlay store's, not this hook's.** Two reasons, and
 * either alone would be enough. A `FlatList` row is unmounted as it leaves the
 * window and mounted again on the way back, so local state would be discarded
 * and re-seeded from a post that has not caught up — the reader would watch
 * their own like undo itself while scrolling. And the same post is on two
 * screens at once: liking it on the detail screen has to show in the feed
 * behind it. Rolling back is the same call with the old values.
 *
 * **A failure rolls back and says nothing.** The icon returning to how it was
 * is the whole of what the reader is told; the reason goes to `reportError`,
 * which the developer sees and the reader does not.
 *
 * `isLikeLoading` stays local on purpose: it guards a double tap and means
 * nothing once the row is gone.
 */
export function usePostActions({ post }: UsePostActionsOptions) {
    const { t } = useI18n();
    const patch = usePostOverlayStore((s) => s.patch);

    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
    const markDeleted = useDeletedContentStore((s) => s.markPost);
    const unmarkDeleted = useDeletedContentStore((s) => s.unmarkPost);

    const handleLike = useCallback(async () => {
        if (isLikeLoading) return;

        const wasLiked = post.isLiked;
        const previousCount = post.likeCount;

        setIsLikeLoading(true);
        patch(post.id, {
            isLiked: !wasLiked,
            likeCount: wasLiked ? previousCount - 1 : previousCount + 1,
        });

        try {
            if (wasLiked) await feedApi.unlikePost(post.id);
            else await feedApi.likePost(post.id);
        } catch (err) {
            patch(post.id, {
                isLiked: wasLiked,
                likeCount: previousCount,
            });
            reportError("post.like", err);
        } finally {
            setIsLikeLoading(false);
        }
    }, [post.id, post.isLiked, post.likeCount, isLikeLoading, patch]);

    const handleBookmark = useCallback(async () => {
        if (isBookmarkLoading) return;

        const wasBookmarked = post.isBookmarked;

        setIsBookmarkLoading(true);
        patch(post.id, { isBookmarked: !wasBookmarked });

        try {
            if (wasBookmarked) await feedApi.unsavePost(post.id);
            else await feedApi.savePost(post.id);
        } catch (err) {
            patch(post.id, { isBookmarked: wasBookmarked });
            reportError("post.bookmark", err);
        } finally {
            setIsBookmarkLoading(false);
        }
    }, [post.id, post.isBookmarked, isBookmarkLoading, patch]);

    /**
     * A share that went out needs no confirmation — the reader watched it
     * happen — and a dismissed sheet is somebody changing their mind. A sheet
     * that would not open is reported to the developer only.
     */
    const handleShare = useCallback(async () => {
        const outcome = await shareLink(t("post.shareText"), postUrl(post.id));

        if (outcome === "error") {
            reportError("post.share", "The share sheet did not open.");
        }
    }, [post.id, t]);

    /**
     * Deletes the post, optimistically. The confirmation is the card's.
     *
     * Marking it deleted is the whole optimistic step: every card showing it
     * — or quoting it, which the server deletes too — draws nothing from that
     * moment, on every screen. A failure unmarks it and the rows come back
     * where they were. A 404 is the outcome asked for, reached some other
     * way, and stays deleted.
     */
    const handleDelete = useCallback(async () => {
        markDeleted(post.id);

        try {
            await feedApi.deletePost(post.id);
        } catch (err) {
            if (isNotFound(err)) return;
            unmarkDeleted(post.id);
            reportError("post.delete", err);
        }
    }, [post.id, markDeleted, unmarkDeleted]);

    return {
        handleLike,
        isLikeLoading,
        handleBookmark,
        isBookmarkLoading,
        handleShare,
        handleDelete,
    };
}
