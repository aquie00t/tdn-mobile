import { FlatList, View } from "react-native";
import { useCallback, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";

import { BlockedNotice } from "@features/profile/ui/components/BlockedNotice";
import { Button } from "@shared/ui/Button";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import type { Post } from "@features/feed/data/feed.types";
import { PostCard } from "@features/feed/ui/components/PostCard";
import { ProfileHeader } from "@features/profile/ui/components/ProfileHeader";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { useI18n } from "@shared/hooks/useI18n";
import { useProfile } from "@features/profile/ui/hooks/useProfile";
import { useUserPosts } from "@features/feed/ui/hooks/useUserPosts";

const keyOf = (post: Post) => post.id;

/**
 * An account: who they are, and what they have written.
 *
 * **Composed in the route**, like the post detail screen and for the same
 * reason. The header is the profile feature's and the list is the feed's — a
 * feature may not import another, and a route may import both. The list owns
 * the scrolling and takes the header as its own, so the whole screen moves
 * together rather than as two scrollers fighting for the gesture.
 */
export default function ProfileRoute() {
    const { t } = useI18n();
    const { username } = useLocalSearchParams<{ username: string }>();

    const { profile, isLoading, error, fetchProfile, retry, patch } =
        useProfile(username);
    const posts = useUserPosts(username);

    // The screens drive their own reads, as they do on the feed and the
    // thread. Both hooks re-key on `username`, so moving to another account
    // re-runs these rather than showing the last one for a frame.
    const { fetchPosts } = posts;
    useEffect(() => {
        void fetchProfile();
        void fetchPosts();
    }, [fetchProfile, fetchPosts]);

    const renderItem = useCallback(
        ({ item }: { item: Post }) => (
            <PostCard {...item} onUpdated={posts.replacePost} />
        ),
        [posts.replacePost],
    );

    /**
     * The two directions of a block, separated here as the header separates
     * them. Either one replaces the timeline: the server answers a blocked
     * profile's posts with an empty page, and an empty list reads as "this
     * account has never written anything" — a different, wrong thing to say.
     */
    const isBlocked = profile?.isBlocked === true;
    const isBlockedBy = profile?.isBlockedBy === true && !isBlocked;
    const hasBlockRelation = isBlocked || isBlockedBy;

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader title={username ? `@${username}` : ""} />

            {isLoading && <Spinner center />}

            {error && !isLoading && (
                <ErrorState
                    message={error}
                    onRetry={retry}
                    retryLabel={t("postList.tryAgain")}
                />
            )}

            {profile && !error && (
                <FlatList
                    data={hasBlockRelation ? [] : posts.posts}
                    keyExtractor={keyOf}
                    renderItem={renderItem}
                    onEndReached={posts.loadMore}
                    onEndReachedThreshold={0.5}
                    // Same reasoning as the feed: the default keeps ten
                    // screenfuls either side mounted, and every one of them
                    // repaints on a theme change.
                    windowSize={7}
                    maxToRenderPerBatch={5}
                    ListHeaderComponent={
                        <>
                            <ProfileHeader profile={profile} onPatch={patch} />

                            {hasBlockRelation && (
                                <BlockedNotice
                                    username={profile.username}
                                    isBlockedByMe={isBlocked}
                                />
                            )}

                            {!hasBlockRelation && posts.isLoading && (
                                <View className="py-8">
                                    <Spinner />
                                </View>
                            )}

                            {!hasBlockRelation &&
                                posts.error &&
                                !posts.isLoading && (
                                    <ErrorState
                                        message={posts.error}
                                        onRetry={posts.retry}
                                        retryLabel={t("postList.tryAgain")}
                                    />
                                )}
                        </>
                    }
                    ListEmptyComponent={
                        hasBlockRelation ||
                        posts.isLoading ||
                        posts.error ? null : (
                            <EmptyState title={t("postList.empty")} />
                        )
                    }
                    ListFooterComponent={
                        posts.isLoadingMore ? (
                            <View className="py-6">
                                <Spinner />
                            </View>
                        ) : !hasBlockRelation &&
                          posts.hasMore &&
                          posts.posts.length > 0 ? (
                            <View className="items-center py-4">
                                <Button
                                    label={t("common.loadMore")}
                                    size="sm"
                                    variant="outline"
                                    onPress={posts.loadMore}
                                />
                            </View>
                        ) : null
                    }
                />
            )}
        </Screen>
    );
}
