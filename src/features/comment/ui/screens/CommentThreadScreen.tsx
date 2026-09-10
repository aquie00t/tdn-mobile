import { FlatList, KeyboardAvoidingView, Platform, View } from "react-native";
import { useCallback, useEffect, useMemo } from "react";

import { Button } from "@shared/ui/Button";
import { CommentBox } from "../components/CommentBox";
import { CommentCard } from "../components/CommentCard";
import type { Comment, CommentTarget } from "../../data/comment.types";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { useComment } from "../hooks/useComment";
import { useCommentReplies } from "../hooks/useCommentReplies";
import { useI18n } from "@shared/hooks/useI18n";

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
    const { t } = useI18n();

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

    const renderItem = useCallback(
        ({ item }: { item: Comment }) => <CommentCard comment={item} />,
        [],
    );

    const retry = () => {
        retryComment();
        void fetchReplies();
    };

    return (
        <Screen edges={{ top: true, bottom: true }}>
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
                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <FlatList
                        data={replies}
                        keyExtractor={keyOf}
                        renderItem={renderItem}
                        ListHeaderComponent={
                            <>
                                {/* Not pressable: it is already this screen. */}
                                <CommentCard
                                    comment={comment}
                                    isPressable={false}
                                />

                                {/*
                                 * No heading over the replies. There is no key
                                 * for one and the 571 are copied verbatim; the
                                 * head card and the composer already say where
                                 * the comment ends and the answers begin.
                                 */}

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
