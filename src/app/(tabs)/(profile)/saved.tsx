import { FlatList, Pressable, View } from "react-native";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { BookmarkIcon } from "@shared/ui/icons/lucide";
import { Button } from "@shared/ui/Button";
import type { Comment } from "@features/comment/data/comment.types";
import { CommentCard } from "@features/comment/ui/components/CommentCard";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import type { Post } from "@features/feed/data/feed.types";
import { PostCard } from "@features/feed/ui/components/PostCard";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { cn } from "@shared/ui/cn";
import { useBookmarks } from "@shared/hooks/useBookmarks";
import { useI18n } from "@shared/hooks/useI18n";

type SavedTab = "posts" | "comments";

const postKey = (post: Post) => post.id;
const commentKey = (comment: Comment) => comment.id;

/**
 * Everything the reader has saved.
 *
 * **Composed in the route**, like the profile screen and the tag view: one
 * endpoint answers posts and comments together, their cards belong to two
 * features, and a feature may not import another. The paging is generic and
 * lives in `shared/`; the types it is instantiated with are the ones this file
 * already has to know.
 *
 * Inside the profile tab's stack rather than in the bar: five tabs is what a
 * 360px phone holds, and a saved list is something reached from an account
 * rather than switched to — which is also where the web keeps it.
 *
 * Articles are in the answer and are not drawn. There are no article screens
 * in this app yet; the third tab lands with them, and its copy is already
 * written.
 */
export default function SavedRoute() {
    const { t } = useI18n();
    const [tab, setTab] = useState<SavedTab>("posts");

    const {
        posts,
        comments,
        isLoading,
        isLoadingMore,
        error,
        loadMoreError,
        hasMorePosts,
        hasMoreComments,
        retry,
        retryLoadMore,
        loadMore,
        replacePost,
    } = useBookmarks<Post, Comment>();

    const isPosts = tab === "posts";

    const renderPost = useCallback(
        ({ item }: { item: Post }) => (
            <PostCard {...item} onUpdated={replacePost} />
        ),
        [replacePost],
    );

    /*
     * A saved comment opens its own thread, which lives in the **Home** tab's
     * stack — `/comments/[id]` can exist at one URL, and that is where it is.
     * The notifications list and the tag view make the same jump, for the same
     * reason.
     */
    const renderComment = useCallback(
        ({ item }: { item: Comment }) => <CommentCard comment={item} />,
        [],
    );

    /*
     * Only the list being looked at asks for more, and only while it can still
     * grow. The endpoint pages both kinds together, so a request from a
     * finished list lands entirely in the tab nobody is looking at — with a
     * spinner under this one to say so.
     *
     * Memoised because `FlatList` treats a changed `onEndReached` as a reason
     * to re-evaluate whether the end has been reached, which is how a fresh
     * closure on every render turns into repeated calls.
     */
    const reachPostsEnd = useCallback(() => {
        if (hasMorePosts) void loadMore();
    }, [hasMorePosts, loadMore]);

    const reachCommentsEnd = useCallback(() => {
        if (hasMoreComments) void loadMore();
    }, [hasMoreComments, loadMore]);

    /**
     * One list's own footer.
     *
     * Per list rather than shared. The request carries a page of both kinds,
     * so the only honest place to report that it is out — or that it failed —
     * is under a list still expecting rows: a spinner under a finished list
     * promises rows that will never arrive, and a failure about posts sitting
     * under a complete set of comments has nothing there to retry it with.
     */
    const footerFor = (hasMore: boolean) => {
        if (!hasMore) return null;

        if (isLoadingMore) {
            return (
                <View className="py-6">
                    <Spinner />
                </View>
            );
        }

        if (loadMoreError) {
            return (
                <View className="items-center gap-2 py-4">
                    <Text size="caption" tone="danger">
                        {loadMoreError}
                    </Text>
                    <Button
                        label={t("postList.tryAgain")}
                        size="sm"
                        variant="outline"
                        onPress={retryLoadMore}
                    />
                </View>
            );
        }

        return (
            <View className="items-center py-4">
                <Button
                    label={t("common.loadMore")}
                    size="sm"
                    variant="outline"
                    onPress={() => void loadMore()}
                />
            </View>
        );
    };

    /*
     * One empty state for a reader who has saved nothing at all, and the
     * list's own for a tab that happens to be empty. "Save posts for later"
     * under a list of saved comments would be telling somebody they have
     * nothing while they are looking at it.
     */
    const hasNothing = posts.length === 0 && comments.length === 0;

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader title={t("bookmarks.title")} />

            <View className="px-4 pb-3">
                <Text size="caption" tone="subtle">
                    {t("bookmarks.subtitle")}
                </Text>
            </View>

            <View className="flex-row border-b border-ink/10">
                <TabButton
                    label={t("bookmarks.tabPosts")}
                    isActive={isPosts}
                    onPress={() => setTab("posts")}
                />
                <TabButton
                    label={t("bookmarks.tabComments")}
                    isActive={!isPosts}
                    onPress={() => setTab("comments")}
                />
            </View>

            {isLoading ? (
                <Spinner center />
            ) : error ? (
                <ErrorState
                    message={error}
                    onRetry={retry}
                    retryLabel={t("postList.tryAgain")}
                />
            ) : hasNothing ? (
                <EmptyState
                    title={t("bookmarks.emptyTitle")}
                    description={t("bookmarks.emptyBody")}
                    icon={<BookmarkIcon size={28} className="text-ink/40" />}
                />
            ) : (
                /*
                 * Both lists stay mounted and one is hidden, rather than a
                 * ternary that unmounts the other. A `FlatList` that is
                 * unmounted loses its scroll position, so a reader five pages
                 * into their saved posts who glances at the comments tab comes
                 * back to the top of a hundred rows — and because the rows are
                 * still in state, nothing reloads to explain the jump.
                 *
                 * The hidden one is handed no `onEndReached` at all: laid out
                 * at no height, its content is shorter than its viewport by
                 * definition, so it would ask for the next page immediately.
                 */
                <>
                    <ListPane isVisible={isPosts}>
                        <FlatList
                            data={posts}
                            keyExtractor={postKey}
                            renderItem={renderPost}
                            onEndReached={isPosts ? reachPostsEnd : undefined}
                            onEndReachedThreshold={0.5}
                            // The same two as every other list here: the
                            // defaults keep ten screenfuls either side
                            // mounted, and all of them repaint on a theme
                            // change.
                            windowSize={7}
                            maxToRenderPerBatch={5}
                            ListEmptyComponent={
                                <EmptyState title={t("bookmarks.emptyPosts")} />
                            }
                            ListFooterComponent={footerFor(hasMorePosts)}
                        />
                    </ListPane>

                    <ListPane isVisible={!isPosts}>
                        <FlatList
                            data={comments}
                            keyExtractor={commentKey}
                            renderItem={renderComment}
                            onEndReached={
                                isPosts ? undefined : reachCommentsEnd
                            }
                            onEndReachedThreshold={0.5}
                            windowSize={7}
                            maxToRenderPerBatch={5}
                            ListEmptyComponent={
                                <EmptyState
                                    title={t("bookmarks.emptyComments")}
                                />
                            }
                            ListFooterComponent={footerFor(hasMoreComments)}
                        />
                    </ListPane>
                </>
            )}
        </Screen>
    );
}

/** Holds a list's place in the tree while the other tab is on screen. */
function ListPane({
    isVisible,
    children,
}: {
    isVisible: boolean;
    children: ReactNode;
}) {
    return (
        <View className={cn("flex-1", !isVisible && "hidden")}>{children}</View>
    );
}

interface TabButtonProps {
    label: string;
    isActive: boolean;
    onPress: () => void;
}

/**
 * One of the two strip buttons.
 *
 * The underline is drawn inset from both edges, as the web's is: a rule that
 * runs the full width of the button reads as a border between the two rather
 * than as a mark on one.
 */
function TabButton({ label, isActive, onPress }: TabButtonProps) {
    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={onPress}
            className="flex-1 items-center py-3 active:bg-ink/5"
        >
            <Text
                size="small"
                tone={isActive ? "default" : "subtle"}
                className="font-medium"
            >
                {label}
            </Text>
            <View
                className={cn(
                    "mt-2 h-0.5 w-12 rounded-full",
                    isActive ? "bg-ink" : "bg-transparent",
                )}
            />
        </Pressable>
    );
}
