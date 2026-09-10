import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import { Button } from "@shared/ui/Button";
import type { Profile } from "../../data/profile.types";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { RichText } from "@shared/ui/RichText";
import { Text } from "@shared/ui/Text";
import { useFollowAction } from "../hooks/useFollowAction";
import { useI18n } from "@shared/hooks/useI18n";

export interface ProfileHeaderProps {
    profile: Profile;
    /** Applied to the copy the screen holds, so the counts stay in step. */
    onPatch: (changes: Partial<Profile>) => void;
}

const BANNER = { width: "100%", height: "100%" } as const;

const joinedFormatters = new Map<string, Intl.DateTimeFormat>();

function formatJoined(iso: string, locale: string): string {
    let formatter = joinedFormatters.get(locale);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
        });
        joinedFormatters.set(locale, formatter);
    }

    return formatter.format(new Date(iso));
}

/**
 * Everything above an account's posts.
 *
 * **The two directions of a block render differently, and that is the point of
 * separating them here rather than later.** `isBlocked` — you blocked them —
 * offers the way out, so the header keeps a control. `isBlockedBy` — they
 * blocked you — is a wall, and offering anything would be offering something
 * that cannot work. When both are set the unblock control wins, because it is
 * the useful one; the server keeps the other side's row either way.
 *
 * Blocking itself is PR 22. What is here is the *state*, drawn correctly from
 * the start, which is the part that is expensive to retrofit.
 */
export function ProfileHeader({ profile, onPatch }: ProfileHeaderProps) {
    const { t, locale } = useI18n();
    const router = useRouter();

    const isBlocked = profile.isBlocked === true;
    const isBlockedBy = profile.isBlockedBy === true && !isBlocked;

    const { toggle, isLoading } = useFollowAction({
        account: profile,
        isFollowing: profile.isFollowing,
        onChange: (isFollowing) =>
            onPatch({
                isFollowing,
                followersCount: profile.followersCount + (isFollowing ? 1 : -1),
            }),
    });

    const openFollows = (type: "followers" | "following") =>
        router.push({
            pathname: "/profile/[username]/follows",
            params: { username: profile.username, type },
        });

    return (
        <View className="border-b border-ink/10">
            <View className="h-32 bg-surface-2">
                {profile.bannerUrl.length > 0 && (
                    <Image
                        source={{ uri: profile.bannerUrl }}
                        style={BANNER}
                        contentFit="cover"
                        transition={150}
                    />
                )}
            </View>

            <View className="px-4 pb-4">
                <View className="-mt-10 flex-row items-end justify-between">
                    {/*
                     * The ring is the ground rather than a border colour, so
                     * the avatar reads as sitting on the page and punching a
                     * hole through the banner behind it.
                     */}
                    <View className="rounded-full border-4 border-ground">
                        {profile.avatarUrl.length > 0 ? (
                            <Avatar uri={profile.avatarUrl} size={72} />
                        ) : (
                            <View className="h-[72px] w-[72px] items-center justify-center rounded-full border border-ink/10 bg-surface-1">
                                <ProfileIcon
                                    size={32}
                                    className="text-ink/40"
                                />
                            </View>
                        )}
                    </View>

                    {/*
                     * Nothing at all for someone who has blocked you. There is
                     * no action that would work, and a disabled Follow button
                     * would invite a tap and explain nothing.
                     */}
                    {profile.isMe ? null : isBlocked ? (
                        <Text size="small" tone="subtle" className="pb-2">
                            {t("block.youBlockedTitle", {
                                username: profile.username,
                            })}
                        </Text>
                    ) : isBlockedBy ? null : (
                        <Button
                            label={
                                profile.isFollowing
                                    ? t("profile.following")
                                    : t("profile.follow")
                            }
                            size="sm"
                            variant={
                                profile.isFollowing ? "outline" : "primary"
                            }
                            loading={isLoading}
                            onPress={() => void toggle()}
                        />
                    )}
                </View>

                <View className="gap-1 pt-3">
                    {profile.fullName.length > 0 && (
                        <Text size="title">{profile.fullName}</Text>
                    )}
                    <Text tone="subtle">@{profile.username}</Text>
                </View>

                {profile.bio.length > 0 && (
                    <RichText text={profile.bio} className="pt-3" />
                )}

                <View className="flex-row flex-wrap items-center gap-x-4 pt-3">
                    {profile.location.length > 0 && (
                        <Text size="small" tone="subtle">
                            {profile.location}
                        </Text>
                    )}
                    <Text size="small" tone="subtle">
                        {t("profile.joined")}{" "}
                        {formatJoined(profile.createdAt, locale)}
                    </Text>
                </View>

                <View className="flex-row gap-5 pt-3">
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => openFollows("following")}
                        hitSlop={8}
                        className="flex-row items-center gap-1.5"
                    >
                        <Text size="small" className="font-semibold">
                            {profile.followingCount ?? 0}
                        </Text>
                        <Text size="small" tone="subtle">
                            {t("profile.followingCount")}
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="button"
                        onPress={() => openFollows("followers")}
                        hitSlop={8}
                        className="flex-row items-center gap-1.5"
                    >
                        <Text size="small" className="font-semibold">
                            {profile.followersCount}
                        </Text>
                        <Text size="small" tone="subtle">
                            {t("profile.followers")}
                        </Text>
                    </Pressable>

                    <View className="flex-row items-center gap-1.5">
                        <Text size="small" className="font-semibold">
                            {profile.postCount}
                        </Text>
                        <Text size="small" tone="subtle">
                            {t("profile.posts")}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}
