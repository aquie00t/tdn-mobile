import { useCallback, useState } from "react";

import { feedApi } from "../../data/feed.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import type { Post } from "../../data/feed.types";
import { postUrl } from "@shared/utils/web-url";
import { shareLink } from "@shared/utils/share";
import { useI18n } from "@shared/hooks/useI18n";
import { usePostOverlayStore } from "../store/post-overlay.store";
import { useToastStore } from "@shared/store/toast.store";

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
 * `isLikeLoading` stays local on purpose: it guards a double tap and means
 * nothing once the row is gone.
 *
 * There is no signed-out branch. The web opens its auth modal here; this app
 * is behind a sign-in wall, so there is nobody to open it for.
 */
export function usePostActions({ post }: UsePostActionsOptions) {
    const { t } = useI18n();
    const addToast = useToastStore((s) => s.addToast);
    const patch = usePostOverlayStore((s) => s.patch);

    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

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
            addToast({ type: "error", message: getErrorMessage(err) });
        } finally {
            setIsLikeLoading(false);
        }
    }, [post.id, post.isLiked, post.likeCount, isLikeLoading, patch, addToast]);

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
            addToast({ type: "error", message: getErrorMessage(err) });
        } finally {
            setIsBookmarkLoading(false);
        }
    }, [post.id, post.isBookmarked, isBookmarkLoading, patch, addToast]);

    /**
     * Only a failure is reported. A share that went out needs no confirmation
     * — the reader watched it happen — and a dismissed sheet is somebody
     * changing their mind, which is not an error to toast at them.
     */
    const handleShare = useCallback(async () => {
        const outcome = await shareLink(t("post.shareText"), postUrl(post.id));

        if (outcome === "error") {
            addToast({ type: "error", message: t("common.shareFailed") });
        }
    }, [post.id, t, addToast]);

    return {
        handleLike,
        isLikeLoading,
        handleBookmark,
        isBookmarkLoading,
        handleShare,
    };
}
