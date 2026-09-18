import { FlatList, Pressable, View } from "react-native";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { ArticleCard } from "@features/article/ui/components/ArticleCard";
import type { ArticleSummary } from "@features/article/data/article.types";
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
import { readerFacingMessage } from "@shared/utils/report-error";
import { cn } from "@shared/ui/cn";
import { useBookmarks } from "@shared/hooks/useBookmarks";
import { useI18n } from "@shared/hooks/useI18n";
import {
    useWithoutDeletedComments,
    useWithoutDeletedPosts,
} from "@shared/hooks/useWithoutDeleted";

type SavedTab = "posts" | "comments" | "articles";

const postKey = (post: Post) => post.id;
const commentKey = (comment: Comment) => comment.id;
const articleKey = (article: ArticleSummary) => article.id;

/**
 * Everything the reader has saved.
 *
 * **Composed in the route**, like the profile screen and the tag view: one
 * endpoint answers posts, comments and articles together, their cards belong
 * to three features, and a feature may not import another. The paging is generic and
 * lives in `shared/`; the types it is instantiated with are the ones this file
 * already has to know.
 *
 * Inside the profile tab's stack rather than in the bar: five tabs is what a
 * 360px phone holds, and a saved list is something reached from an account
 * rather than switched to — which is also where the web keeps it.
 */
export default function SavedRoute() {
    const { t } = useI18n();
    const [tab, setTab] = useState<SavedTab>("posts");

    const {
        posts,
        comments,
        articles,
        isLoading,
        isLoadingMore,
        error,
        loadMoreError,
        hasMorePosts,
        hasMoreComments,
        hasMoreArticles,
        retry,
        retryLoadMore,
        loadMore,
        replacePost,
    } = useBookmarks<Post, Comment, ArticleSummary>();
    // Without what the reader deleted, so an emptied tab shows its empty state.
    const visiblePosts = useWithoutDeletedPosts(posts);
    const visibleComments = useWithoutDeletedComments(comments);

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
     * The same card the feed's Articles tab draws, so unsaving here reaches
     * the reading screen and the list through the article overlay — and, like
     * a post, the row stays until the list is next opened, so an accidental
     * tap has something to tap back.
     */
    const renderArticle = useCallback(
        ({ item }: { item: ArticleSummary }) => <ArticleCard article={item} />,
        [],
    );

    /*
     * Only the list being looked at asks for more, and only while it can still
     * grow. The endpoint pages every kind together, so a request from a
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

    const reachArticlesEnd = useCallback(() => {
        if (hasMoreArticles) void loadMore();
    }, [hasMoreArticles, loadMore]);

    /**
     * One list's own footer.
     *
     * Per list rather than shared. The request carries a page of every kind,
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
                    <Text size="caption" tone="subtle">
                        {readerFacingMessage(loadMoreError)}
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
    const hasNothing =
        visiblePosts.length === 0 &&
        visibleComments.length === 0 &&
        articles.length === 0;

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
                    isActive={tab === "posts"}
                    onPress={() => setTab("posts")}
                />
                <TabButton
                    label={t("bookmarks.tabComments")}
                    isActive={tab === "comments"}
                    onPress={() => setTab("comments")}
                />
                <TabButton
                    label={t("bookmarks.tabArticles")}
                    isActive={tab === "articles"}
                    onPress={() => setTab("articles")}
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
                 * Every list stays mounted and the others are hidden, rather
                 * than a ternary that unmounts them. A `FlatList` that is
                 * unmounted loses its scroll position, so a reader five pages
                 * into their saved posts who glances at another tab comes
                 * back to the top of a hundred rows — and because the rows are
                 * still in state, nothing reloads to explain the jump.
                 *
                 * The hidden one is handed no `onEndReached` at all: laid out
                 * at no height, its content is shorter than its viewport by
                 * definition, so it would ask for the next page immediately.
                 */
                <>
                    <ListPane isVisible={tab === "posts"}>
                        <FlatList
                            data={visiblePosts}
                            keyExtractor={postKey}
                            renderItem={renderPost}
                            onEndReached={
                                tab === "posts" ? reachPostsEnd : undefined
                            }
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

                    <ListPane isVisible={tab === "comments"}>
                        <FlatList
                            data={visibleComments}
                            keyExtractor={commentKey}
                            renderItem={renderComment}
                            onEndReached={
                                tab === "comments"
                                    ? reachCommentsEnd
                                    : undefined
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

                    <ListPane isVisible={tab === "articles"}>
                        <FlatList
                            data={articles}
                            keyExtractor={articleKey}
                            renderItem={renderArticle}
                            onEndReached={
                                tab === "articles"
                                    ? reachArticlesEnd
                                    : undefined
                            }
                            onEndReachedThreshold={0.5}
                            windowSize={7}
                            maxToRenderPerBatch={5}
                            ListEmptyComponent={
                                <EmptyState
                                    title={t("bookmarks.emptyArticles")}
                                />
                            }
                            ListFooterComponent={footerFor(hasMoreArticles)}
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
 * One of the strip's buttons.
 *
 * The underline is drawn inset from both edges, as the web's is: a rule that
 * runs the full width of the button reads as a border between them rather
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
