import { FlatList, View } from "react-native";
import { useCallback, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@shared/ui/Button";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import type { Post } from "@features/feed/data/feed.types";
import { PostCard } from "@features/feed/ui/components/PostCard";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useFeed } from "@features/feed/ui/hooks/useFeed";
import { useI18n } from "@shared/hooks/useI18n";

const keyOf = (post: Post) => post.id;

/**
 * Everything tagged with one word.
 *
 * **Composed in the route**, like the profile screen: the list and the card
 * belong to the feed, and a feature may not import another. There is nothing
 * of the explore feature left on this screen once the header is drawn, which
 * is why it is written here rather than as a screen of its own.
 *
 * `useFeed()` with no filters plus `fetchPosts({ tag })` is the whole read.
 * The hook's own note records that page two once dropped the tag and appended
 * unrelated posts, which is why `buildParams` carries the last filter forward
 * — `loadMore` here relies on exactly that.
 *
 * The web shows a Posts / Articles strip on this screen. There are no article
 * screens in this app yet, so this is posts; the strip lands with them.
 *
 * Tapping a post opens it in the **Home** tab, because `/post/[id]` can live
 * at one URL and that URL is in the home stack. The notifications list does
 * the same thing, and the alternative — a second file resolving to the same
 * route — is the collision that took `/profile` out.
 */
export default function TagRoute() {
    const { t } = useI18n();
    const { tag } = useLocalSearchParams<{ tag: string }>();

    const {
        posts,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        fetchPosts,
        loadMore,
        replacePost,
    } = useFeed();

    useEffect(() => {
        if (!tag) return;
        void fetchPosts({ tag });
    }, [tag, fetchPosts]);

    const renderItem = useCallback(
        ({ item }: { item: Post }) => (
            <PostCard {...item} onUpdated={replacePost} />
        ),
        [replacePost],
    );

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader title={`#${tag ?? ""}`} />

            <View className="border-b border-ink/5 px-4 pb-3">
                <Text size="caption" tone="subtle">
                    {t("explore.postsTaggedSubtitle", { tag: tag ?? "" })}
                </Text>
            </View>

            {isLoading ? (
                <Spinner center />
            ) : error ? (
                <ErrorState
                    message={error}
                    onRetry={() => void fetchPosts({ tag })}
                    retryLabel={t("postList.tryAgain")}
                />
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={keyOf}
                    renderItem={renderItem}
                    onEndReached={() => void loadMore()}
                    onEndReachedThreshold={0.5}
                    // The same two as the feed and the profile: the defaults
                    // keep ten screenfuls either side mounted, and every one
                    // of them repaints on a theme change.
                    windowSize={7}
                    maxToRenderPerBatch={5}
                    ListEmptyComponent={
                        <EmptyState title={t("postList.empty")} />
                    }
                    ListFooterComponent={
                        isLoadingMore ? (
                            <View className="py-6">
                                <Spinner />
                            </View>
                        ) : hasMore && posts.length > 0 ? (
                            <View className="items-center py-4">
                                <Button
                                    label={t("common.loadMore")}
                                    size="sm"
                                    variant="outline"
                                    onPress={() => void loadMore()}
                                />
                            </View>
                        ) : null
                    }
                />
            )}
        </Screen>
    );
}
