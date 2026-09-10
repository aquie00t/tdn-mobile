import { FlatList, Pressable, View } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { Button } from "@shared/ui/Button";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { FeedFilterRow } from "../components/FeedFilterRow";
import { feedIdentity } from "../../domain/feed-filters";
import { FeedTypeStrip } from "../components/FeedTypeStrip";
import { PostCard } from "../components/PostCard";
import type { Post, PostCategory, PostType } from "../../data/feed.types";
import { Screen } from "@shared/ui/Screen";
import { CreateIcon } from "@shared/ui/icons/lucide";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useFeed } from "../hooks/useFeed";
import { useI18n } from "@shared/hooks/useI18n";

/** Half a screen from the end, which is about one row's reading time. */
const END_THRESHOLD = 0.5;

/** About two screens of rows, so the first scroll has somewhere to go. */
const INITIAL_ROWS = 8;

/**
 * The tabs the filter row appears on — and the tabs the write button does not.
 *
 * Both follow from who writes those feeds. News and Updates are bot accounts,
 * so "only the ones I follow" is a real cut; Community is everybody, where the
 * same chip would turn the tab into a second one. The web draws the same line
 * in the same place.
 */
const FILTERABLE_TYPES = new Set<PostType>(["TECH_NEWS", "SYSTEM_UPDATE"]);

export function FeedScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const [type, setType] = useState<PostType>("COMMUNITY");
    const [followedOnly, setFollowedOnly] = useState(false);
    const [categories, setCategories] = useState<PostCategory[]>([]);
    const canFilter = FILTERABLE_TYPES.has(type);
    const {
        posts,
        isLoading,
        isRefreshing,
        isLoadingMore,
        error,
        loadMoreError,
        hasMore,
        fetchPosts,
        refresh,
        loadMore,
        retry,
        retryLoadMore,
        replacePost,
    } = useFeed(followedOnly, categories);

    /*
     * Keyed on what makes one feed a different feed, not on the objects that
     * describe it: `categories` is a fresh array every render, so depending on
     * it directly would re-read the feed on every keystroke elsewhere on the
     * screen. `feedIdentity` also sorts, so the same two chips chosen in the
     * other order do not buy a round trip to the list already on screen.
     *
     * `fetchPosts` stamps each request, so a slow answer from a tab or a
     * filter that has been left cannot land last.
     */
    const identity = feedIdentity({ type, followedOnly, categories });

    useEffect(() => {
        void fetchPosts(type);
        // `identity` is what actually changed; `type` is read from it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [identity, fetchPosts]);

    // All three are stable, so a re-render of this screen does not hand
    // `FlatList` new functions — it treats a changed `onEndReached` as a
    // reason to re-evaluate, and a changed `renderItem` as a reason to rebuild
    // every visible row.
    const handleRefresh = useCallback(() => void refresh(), [refresh]);
    const handleEndReached = useCallback(() => void loadMore(), [loadMore]);

    const renderItem = useCallback(
        ({ item }: { item: Post }) => (
            <PostCard {...item} onUpdated={replacePost} />
        ),
        [replacePost],
    );

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <FeedTypeStrip
                active={type}
                onSelect={(next) => {
                    setType(next);
                    // The narrowings belong to the feed that was open. Carried
                    // across, a reader who filtered News to Frontend would find
                    // Updates already filtered by something they never chose
                    // there — and the web clears them for the same reason.
                    setFollowedOnly(false);
                    setCategories([]);
                }}
            />

            {canFilter && (
                <FeedFilterRow
                    followedOnly={followedOnly}
                    onToggleFollowedOnly={() =>
                        setFollowedOnly((previous) => !previous)
                    }
                    categories={categories}
                    onToggleCategory={(category) =>
                        setCategories((previous) =>
                            previous.includes(category)
                                ? previous.filter((value) => value !== category)
                                : [...previous, category],
                        )
                    }
                />
            )}

            {/*
             * `isLoading` on its own, not `isLoading && posts.length === 0`.
             *
             * Keeping the previous tab's rows up while the new one loads reads
             * as the tab not having changed at all — the underline moves and
             * nothing else does, so the wait looks like a freeze. Emptying the
             * space says plainly that the old list is gone and a new one is
             * coming. It is what the web's `PostList` does, and the reason is
             * the same.
             *
             * Pull-to-refresh is exempt by construction: `refresh` runs the
             * request without raising this flag, so the list stays put under
             * its own spinner.
             */}
            {isLoading ? (
                <Spinner center />
            ) : error ? (
                <ErrorState
                    message={error}
                    onRetry={retry}
                    retryLabel={t("postList.tryAgain")}
                />
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={keyOf}
                    renderItem={renderItem}
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={END_THRESHOLD}
                    /*
                     * `windowSize` is measured in screenfuls, and its default
                     * of 21 means ten of them either side of what is visible —
                     * so a feed of twenty posts keeps every one of them
                     * mounted. That is why a theme change felt slow: every
                     * card in memory repaints, not the two or three on screen.
                     *
                     * An earlier comment here claimed lowering it made
                     * scrolling mount *more*. That was wrong, and it is the
                     * reason it was left at the default for two PRs.
                     */
                    windowSize={7}
                    maxToRenderPerBatch={5}
                    initialNumToRender={INITIAL_ROWS}
                    ListEmptyComponent={
                        <EmptyState title={t("postList.empty")} />
                    }
                    ListFooterComponent={
                        <FeedFooter
                            isLoadingMore={isLoadingMore}
                            loadMoreError={loadMoreError}
                            onRetry={retryLoadMore}
                            hasMore={hasMore}
                            count={posts.length}
                        />
                    }
                />
            )}

            {/*
             * Only on Community, and not to keep the screen tidy: `TECH_NEWS`
             * and `SYSTEM_UPDATE` are refused for anyone but a bot account, so
             * a post written from either of those tabs would be a Community
             * post the reader then cannot find in the list they wrote it from.
             * The web hides its composer on the same two tabs for the same
             * reason.
             */}
            {type === "COMMUNITY" && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("postBox.post")}
                    onPress={() => router.push("/compose")}
                    className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-ink active:bg-ink-hover"
                    style={{
                        // The one shadow in the app. A control that floats
                        // over the list has to say it is above it, and on a
                        // dark ground a border alone does not.
                        elevation: 6,
                    }}
                >
                    <CreateIcon size={26} className="text-ground" />
                </Pressable>
            )}
        </Screen>
    );
}

const keyOf = (post: Post) => post.id;

/**
 * What sits under the last row: a spinner, a failure that leaves the list
 * alone, or the end of the feed.
 *
 * The failure is deliberately not an `ErrorState` — that one fills the space
 * it is given and would push the posts off screen. Somebody who already has
 * twenty rows has not lost anything; they have simply not gained twenty more.
 */
function FeedFooter({
    isLoadingMore,
    loadMoreError,
    onRetry,
    hasMore,
    count,
}: {
    isLoadingMore: boolean;
    loadMoreError: string | null;
    onRetry: () => void;
    hasMore: boolean;
    count: number;
}) {
    const { t } = useI18n();

    if (loadMoreError) {
        return (
            <View className="items-center gap-3 py-6">
                <Text size="small" tone="subtle">
                    {loadMoreError}
                </Text>
                <Button
                    label={t("postList.tryAgain")}
                    size="sm"
                    variant="outline"
                    onPress={onRetry}
                />
            </View>
        );
    }

    if (isLoadingMore) {
        return (
            <View className="py-6">
                <Spinner />
            </View>
        );
    }

    // Only once there is something to be at the end of. On an empty feed the
    // empty state says it already, and "no more posts" under it would be a
    // second answer to a question nobody asked twice.
    if (!hasMore && count > 0) {
        return (
            <View className="items-center py-6">
                <Text size="small" tone="subtle">
                    {t("postList.noMore")}
                </Text>
            </View>
        );
    }

    return null;
}
