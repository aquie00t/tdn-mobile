import { FlatList, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";

import { BlockedNotice } from "@features/profile/ui/components/BlockedNotice";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import type { Post } from "@features/feed/data/feed.types";
import { PostCard } from "@features/feed/ui/components/PostCard";
import { ProfileHeader } from "@features/profile/ui/components/ProfileHeader";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { SettingsIcon } from "@shared/ui/icons/lucide";
import { Spinner } from "@shared/ui/Spinner";
import { useI18n } from "@shared/hooks/useI18n";
import { useProfile } from "@features/profile/ui/hooks/useProfile";
import { useSessionStore } from "@core/session/session.store";
import { useUserPosts } from "@features/feed/ui/hooks/useUserPosts";

const keyOf = (post: Post) => post.id;

/**
 * Your own profile, drawn by the same pieces that draw anybody else's.
 *
 * The theme switcher and sign out used to sit under the header here, because
 * this tab was once the only way to leave the app. They have their own screen
 * now: a profile is a page about a person, and a switch for how the app looks
 * is not part of that.
 */
export default function ProfileTab() {
    const { t } = useI18n();
    const router = useRouter();
    const username = useSessionStore((s) => s.user?.username) ?? "";

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

    // Your own profile can carry neither flag, but the notice is rendered from
    // the same condition everywhere so a change to it cannot apply in one
    // place and not the other.
    const isBlocked = profile?.isBlocked === true;
    const isBlockedBy = profile?.isBlockedBy === true && !isBlocked;
    const hasBlockRelation = isBlocked || isBlockedBy;

    return (
        <Screen edges={{ top: true, bottom: false }}>
            {/*
             * No back arrow: this is a tab, not something pushed. The gear is
             * the way into settings, which is where the controls that used to
             * be bolted under this header now live.
             */}
            <ScreenHeader
                title={username ? `@${username}` : ""}
                showBack={false}
                right={
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("settings.title")}
                        onPress={() => router.push("/settings")}
                        hitSlop={8}
                        className="h-10 w-10 items-center justify-center rounded-full active:bg-ink/10"
                    >
                        <SettingsIcon size={20} className="text-ink" />
                    </Pressable>
                }
            />

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

                            {posts.isLoading && (
                                <View className="py-8">
                                    <Spinner />
                                </View>
                            )}
                        </>
                    }
                    ListEmptyComponent={
                        posts.isLoading || posts.error ? null : (
                            <EmptyState title={t("postList.empty")} />
                        )
                    }
                    ListFooterComponent={
                        posts.isLoadingMore ? (
                            <View className="py-6">
                                <Spinner />
                            </View>
                        ) : null
                    }
                />
            )}
        </Screen>
    );
}
