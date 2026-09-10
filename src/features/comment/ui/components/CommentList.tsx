import { FlatList, KeyboardAvoidingView, Platform, View } from "react-native";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";

import { Button } from "@shared/ui/Button";
import { CommentBox } from "./CommentBox";
import { CommentCard } from "./CommentCard";
import type { Comment, CommentTarget } from "../../data/comment.types";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useComments } from "../hooks/useComments";
import { useI18n } from "@shared/hooks/useI18n";

export interface CommentListProps {
    target: CommentTarget;
    /**
     * Drawn above the first comment and scrolled with it — the post itself, on
     * the detail screen.
     *
     * A node rather than something this component builds: a comment belongs to
     * a post *or* an article, and neither of those features may be reached
     * from here. Whoever composes the screen knows which, and hands it over.
     */
    header?: ReactNode;
    /**
     * Told when a comment has been created, so the screen above can move the
     * target's own comment count. The list has no way to reach a post.
     */
    onCommentCreated?: () => void;
}

const keyOf = (comment: Comment) => comment.id;

/**
 * A thread, and the box that adds to it.
 *
 * This owns the scrolling and takes the post as a header rather than sitting
 * inside a scroll view of its own. Two nested scrollers is the shape that
 * makes a phone feel broken: the inner one steals the gesture, the outer one
 * never moves, and a long thread cannot be reached at all.
 */
export function CommentList({
    target,
    header,
    onCommentCreated,
}: CommentListProps) {
    const { t } = useI18n();

    // The route builds this as an object literal, so it is a fresh reference
    // on every render — and `renderItem` closes over it. Left alone, every
    // render of this screen would hand `FlatList` a new function and rebuild
    // each visible row, undoing the memo on the card.
    const { type: targetType, id: targetId } = target;
    const stableTarget = useMemo<CommentTarget>(
        () =>
            targetType === "article"
                ? { type: "article", id: targetId }
                : { type: "post", id: targetId },
        [targetType, targetId],
    );

    const {
        comments,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        fetchComments,
        retry,
        loadMore,
        addComment,
    } = useComments(stableTarget);

    useEffect(() => {
        void fetchComments();
    }, [fetchComments]);

    const renderItem = useCallback(
        ({ item }: { item: Comment }) => (
            <CommentCard comment={item} target={stableTarget} />
        ),
        [stableTarget],
    );

    const handleCreated = useCallback(
        (comment: Comment) => {
            addComment(comment);
            onCommentCreated?.();
        },
        [addComment, onCommentCreated],
    );

    return (
        /*
         * Android resizes the window when the keyboard opens — Expo's default
         * — so the layout below pushes the composer up on its own and this
         * wrapper is told to do nothing there. On iOS nothing resizes, and
         * without the padding the box is typed into from behind the keyboard.
         */
        <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <FlatList
                data={comments}
                keyExtractor={keyOf}
                renderItem={renderItem}
                ListHeaderComponent={
                    <>
                        {header}

                        {/*
                         * Says where the post ends and the thread begins.
                         * Without it the first comment reads as part of the
                         * post it is answering.
                         */}
                        <View className="px-4 pb-2 pt-4">
                            <Text
                                size="caption"
                                tone="subtle"
                                className="uppercase tracking-wider"
                            >
                                {t("post.comments")}
                            </Text>
                        </View>

                        {isLoading && (
                            <View className="py-8">
                                <Spinner />
                            </View>
                        )}
                        {error && !isLoading && (
                            <ErrorState
                                message={error}
                                onRetry={retry}
                                retryLabel={t("commentList.tryAgain")}
                            />
                        )}
                    </>
                }
                // Only once the request has finished. An empty state under a
                // spinner says the thread is empty while it is still being
                // read.
                ListEmptyComponent={
                    isLoading || error ? null : (
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
                    ) : comments.length > 0 ? (
                        <View className="items-center py-4">
                            <Text size="caption" tone="subtle">
                                {t("postList.noMore")}
                            </Text>
                        </View>
                    ) : null
                }
                keyboardShouldPersistTaps="handled"
            />

            <CommentBox
                target={stableTarget}
                onCommentCreated={handleCreated}
            />
        </KeyboardAvoidingView>
    );
}
