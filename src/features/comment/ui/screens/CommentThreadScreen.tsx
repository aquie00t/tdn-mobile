import { FlatList, KeyboardAvoidingView, View } from "react-native";
import { useCallback, useEffect, useMemo } from "react";
import { useIsFocused, useRouter } from "expo-router";

import { Button } from "@shared/ui/Button";
import { CommentBox } from "../components/CommentBox";
import { CommentCard } from "../components/CommentCard";
import { useCommentOverlayStore } from "../store/comment-overlay.store";
import { useDeletedContentStore } from "@shared/store/deleted-content.store";
import type { Comment, CommentTarget } from "../../data/comment.types";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useComment } from "../hooks/useComment";
import { useCommentReplies } from "../hooks/useCommentReplies";
import { useI18n } from "@shared/hooks/useI18n";
import { useWithoutDeletedComments } from "@shared/hooks/useWithoutDeleted";

const keyOf = (reply: Comment) => reply.id;

/**
 * One comment as the head of its own thread.
 *
 * This is what nesting is: a comment is not expanded in place, it is opened.
 * Its replies are the list, the composer writes into it, and each reply is a
 * card that opens the same screen one level deeper. The web has carried this
 * page from the start and the API caps no depth — `create-comment` only checks
 * that a parent belongs to the same post.
 */
export function CommentThreadScreen({ commentId }: { commentId: string }) {
    const { t, locale } = useI18n();

    const {
        comment,
        isLoading,
        error,
        fetchComment,
        retry: retryComment,
    } = useComment(commentId);

    const {
        replies,
        isLoading: isLoadingReplies,
        isLoadingMore,
        hasMore,
        error: repliesError,
        fetchReplies,
        loadMore,
        addReply,
    } = useCommentReplies(commentId);

    useEffect(() => {
        void fetchComment();
        void fetchReplies();
    }, [fetchComment, fetchReplies]);

    /**
     * Narrowed rather than asserted. The database guarantees a comment hangs
     * off exactly one of a post or an article, but one that somehow arrives
     * with neither has nowhere to send a reply — offering the box anyway would
     * post to `/articles//comments`.
     */
    // Read out first: an optional chain inside the dependency list is a
    // different expression from the one the compiler infers, and it refuses to
    // keep the memo rather than guess which was meant.
    const postId = comment?.postId ?? null;
    const articleId = comment?.articleId ?? null;

    const target = useMemo<CommentTarget | null>(() => {
        if (postId) return { type: "post", id: postId };
        if (articleId) return { type: "article", id: articleId };
        return null;
    }, [postId, articleId]);

    const stamp = comment
        ? new Intl.DateTimeFormat(locale, {
              dateStyle: "long",
              timeStyle: "short",
          }).format(new Date(comment.createdAt))
        : "";

    /*
     * The head gone — deleted from its own card here, or from another screen
     * — leaves this screen about nothing, and its replies went with it on the
     * server. So it closes rather than showing an empty thread.
     */
    const router = useRouter();
    const isFocused = useIsFocused();
    const isHeadGone = useDeletedContentStore(
        (s) => s.comments[commentId] === true,
    );
    /*
     * Only while this screen is the one showing. `router.back()` acts on the
     * screen in view, not on the one that asked — so a thread whose head was
     * deleted from another screen on top would close *that* screen. It waits
     * instead, and goes once the reader comes back to it.
     */
    useEffect(() => {
        if (isHeadGone && isFocused && router.canGoBack()) router.back();
    }, [isHeadGone, isFocused, router]);

    const visibleReplies = useWithoutDeletedComments(replies);

    /*
     * A reply deleted from this list takes one off the head's count, as the
     * server does. Read from the overlay as it stands, so two deletes in a row
     * take off two.
     */
    const patchComment = useCommentOverlayStore((s) => s.patch);
    const handleReplyDeleted = useCallback(() => {
        const current =
            useCommentOverlayStore.getState().overlays[commentId]?.replyCount ??
            comment?.replyCount ??
            0;
        patchComment(commentId, { replyCount: Math.max(0, current - 1) });
    }, [commentId, comment?.replyCount, patchComment]);

    const renderItem = useCallback(
        ({ item }: { item: Comment }) => (
            <CommentCard comment={item} onDeleted={handleReplyDeleted} />
        ),
        [handleReplyDeleted],
    );

    const retry = () => {
        retryComment();
        void fetchReplies();
    };

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader title={t("page.comment")} />

            {isLoading && !comment && <Spinner center />}

            {error && !comment && (
                <ErrorState
                    message={error}
                    onRetry={retry}
                    retryLabel={t("commentList.tryAgain")}
                />
            )}

            {comment && (
                <KeyboardAvoidingView className="flex-1" behavior="padding">
                    <FlatList
                        data={visibleReplies}
                        keyExtractor={keyOf}
                        renderItem={renderItem}
                        ListHeaderComponent={
                            <>
                                {/*
                                 * Drawn the way `PostDetailHeader` draws a
                                 * post: the subject at full weight with its
                                 * whole timestamp under it, closed by one
                                 * rule. Left at list weight, the head of this
                                 * screen looked like one of its own replies
                                 * and the screen said nothing about what it
                                 * was for.
                                 *
                                 * Not pressable: it is already this screen.
                                 */}
                                <View className="border-b border-ink/10">
                                    <CommentCard
                                        comment={comment}
                                        isPressable={false}
                                        isHead
                                    />
                                    <View className="px-4 pb-4">
                                        <Text size="caption" tone="subtle">
                                            {stamp}
                                        </Text>
                                    </View>
                                </View>

                                {isLoadingReplies && (
                                    <View className="py-8">
                                        <Spinner />
                                    </View>
                                )}

                                {repliesError && !isLoadingReplies && (
                                    <ErrorState
                                        message={repliesError}
                                        onRetry={fetchReplies}
                                        retryLabel={t("commentList.tryAgain")}
                                    />
                                )}
                            </>
                        }
                        ListEmptyComponent={
                            isLoadingReplies || repliesError ? null : (
                                <EmptyState title={t("commentList.empty")} />
                            )
                        }
                        ListFooterComponent={
                            hasMore ? (
                                <View className="items-center py-4">
                                    <Button
                                        label={
                                            isLoadingMore
                                                ? t("common.loadingMore")
                                                : t("common.loadMore")
                                        }
                                        size="sm"
                                        variant="outline"
                                        loading={isLoadingMore}
                                        disabled={isLoadingMore}
                                        onPress={() => void loadMore()}
                                    />
                                </View>
                            ) : null
                        }
                        keyboardShouldPersistTaps="handled"
                    />

                    {target && (
                        <CommentBox
                            target={target}
                            parentId={commentId}
                            onCommentCreated={addReply}
                        />
                    )}
                </KeyboardAvoidingView>
            )}
        </Screen>
    );
}
