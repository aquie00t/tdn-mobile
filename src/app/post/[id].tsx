import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";

import { CommentList } from "../../features/comment/ui/components/CommentList";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PostDetailHeader } from "../../features/feed/ui/components/PostDetailHeader";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeader } from "../../shared/layout/ScreenHeader";
import { Spinner } from "../../shared/ui/Spinner";
import { useI18n } from "../../shared/hooks/useI18n";
import { usePost } from "../../features/feed/ui/hooks/usePost";
import { usePostOverlayStore } from "../../features/feed/ui/store/post-overlay.store";

/**
 * One post and its thread.
 *
 * **The composition lives in the route on purpose.** This screen is a post
 * (the feed's) above its comments (the comment feature's), and no feature may
 * import another — that boundary is checked by `oxlint`, not by review. A
 * route may import both, so the two halves meet here and nowhere else:
 * `CommentList` owns the scrolling and takes the post as its header, so there
 * is one scroller rather than two fighting over the same gesture.
 *
 * It is also the only place that can bridge the two directions. A new comment
 * has to move the post's own `commentCount`, and the comment feature has no
 * way to reach a post — so the list reports upward and the overlay is written
 * from here.
 */
export default function PostDetailRoute() {
    const { t } = useI18n();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { post, isLoading, error, fetchPost, retry } = usePost(id);
    const patch = usePostOverlayStore((s) => s.patch);

    useEffect(() => {
        void fetchPost();
    }, [fetchPost]);

    const handleCommentCreated = useCallback(() => {
        if (!post) return;
        // Written into the overlay rather than into this screen's copy, so the
        // feed's row behind it moves too.
        patch(post.id, { commentCount: post.commentCount + 1 });
    }, [post, patch]);

    return (
        <Screen edges={{ top: true, bottom: true }}>
            {/*
             * The root navigator hides its own headers, so without this there
             * is no way back on screen at all — only the hardware button and
             * the edge swipe, neither of which announces itself.
             */}
            <ScreenHeader title={t("page.post")} />

            {isLoading && !post && <Spinner center />}

            {error && !post && (
                <ErrorState
                    message={error}
                    onRetry={retry}
                    retryLabel={t("postList.tryAgain")}
                />
            )}

            {post && (
                <CommentList
                    target={{ type: "post", id: post.id }}
                    header={<PostDetailHeader post={post} />}
                    onCommentCreated={handleCommentCreated}
                />
            )}
        </Screen>
    );
}
