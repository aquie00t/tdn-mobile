import { FlatList, View } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { BlockedNotice } from "@features/profile/ui/components/BlockedNotice";
import { Button } from "@shared/ui/Button";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { followTargetId } from "@features/profile/domain/follow-target";
import { MessageButton } from "@features/message/ui/components/MessageButton";
import type { Post } from "@features/feed/data/feed.types";
import { PostCard } from "@features/feed/ui/components/PostCard";
import { ProfileArticles } from "@features/article/ui/components/ProfileArticles";
import { ProfileHeader } from "@features/profile/ui/components/ProfileHeader";
import { ProfileTabs } from "@features/profile/ui/components/ProfileTabs";
import type { ProfileTab } from "@features/profile/ui/components/ProfileTabs";
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
 * reason. The header is the profile feature's, the list is the feed's and the
 * button that opens a conversation is messaging's, and the Articles tab is the
 * article feature's — a feature may not import another, and a route may import
 * all of them. The list owns
 * the scrolling and takes the header as its own, so the whole screen moves
 * together rather than as two scrollers fighting for the gesture.
 */
export default function ProfileRoute() {
    const { t } = useI18n();
    const { username } = useLocalSearchParams<{ username: string }>();

    const { profile, isLoading, error, fetchProfile, retry, patch } =
        useProfile(username);
    const posts = useUserPosts(username);
    const [tab, setTab] = useState<ProfileTab>("posts");

    // The screens drive their own reads, as they do on the feed and the
    // thread. Both hooks re-key on `username`, so moving to another account
    // re-runs these rather than showing the last one for a frame.
    const { fetchPosts } = posts;
    useEffect(() => {
        void fetchProfile();
        void fetchPosts();
    }, [fetchProfile, fetchPosts]);

    /*
     * After a block or an unblock, both reads run again rather than a flag
     * being patched. A block drops both follows, zeroes the counts and
     * empties the timeline; lifting one brings the posts back, and may still
     * leave the other side's block standing. The server is the only thing
     * that knows all of that at once.
     */
    const handleBlockChange = useCallback(() => {
        void fetchProfile();
        void fetchPosts();
    }, [fetchProfile, fetchPosts]);

    // `id` on a profile, `userId` on a follow row — the same reason
    // `followTargetId` exists, and the same field messaging needs.
    const recipientId = profile ? followTargetId(profile) : null;

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

            {profile && !error && tab === "articles" && !hasBlockRelation && (
                /*
                 * Its own list rather than rows in this one: articles are
                 * another resource with their own paging, and the header goes
                 * with them so the whole screen still scrolls as one.
                 */
                <ProfileArticles
                    username={profile.username}
                    isMe={profile.isMe === true}
                    header={
                        <>
                            <ProfileHeader
                                profile={profile}
                                onPatch={patch}
                                onBlockChange={handleBlockChange}
                                action={
                                    recipientId ? (
                                        <MessageButton
                                            recipientId={recipientId}
                                        />
                                    ) : undefined
                                }
                            />
                            <ProfileTabs tab={tab} onChange={setTab} />
                        </>
                    }
                />
            )}

            {profile && !error && (tab === "posts" || hasBlockRelation) && (
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
                            <ProfileHeader
                                profile={profile}
                                onPatch={patch}
                                onBlockChange={handleBlockChange}
                                /*
                                 * Only where there is an id to write to. The
                                 * header draws this beside Follow, so it is
                                 * already absent from your own profile and
                                 * from one either side has blocked.
                                 */
                                action={
                                    recipientId ? (
                                        <MessageButton
                                            recipientId={recipientId}
                                        />
                                    ) : undefined
                                }
                            />

                            {/*
                             * No tabs under a block: the notice replaces
                             * everything this account wrote, articles too.
                             */}
                            {hasBlockRelation ? (
                                <BlockedNotice
                                    username={profile.username}
                                    isBlockedByMe={isBlocked}
                                />
                            ) : (
                                <ProfileTabs tab={tab} onChange={setTab} />
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
