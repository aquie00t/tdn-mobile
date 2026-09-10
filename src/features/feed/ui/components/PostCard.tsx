import { Pressable, View } from "react-native";
import { memo } from "react";

import { Avatar } from "@shared/ui/Avatar";
import {
    BookmarkIcon,
    CommentIcon,
    LikeIcon,
    QuoteIcon,
    ShareIcon,
} from "@shared/ui/icons/lucide";
import type { LucideIcon } from "lucide-react-native";
import { PendingMedia } from "@shared/ui/PendingMedia";
import type { Post } from "../../data/feed.types";
import { PostMedia } from "@shared/ui/PostMedia";
import { SensitiveMedia } from "@shared/ui/SensitiveMedia";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { usePendingMedia } from "../hooks/usePendingMedia";
import { usePostActions } from "../hooks/usePostActions";

export interface PostCardProps extends Post {
    /**
     * Handed a freshly read copy of this post when its pending video resolves.
     * Without one there is nowhere to put the answer, so the placeholder shows
     * the wait but offers no way to end it.
     */
    onUpdated?: (post: Post) => void;
    /**
     * Writes a change into the list that owns this post. Liking and saving are
     * optimistic and roll back through the same call, so a card without one
     * has nowhere to put the result — which is why they are not drawn.
     */
    onPatch?: (postId: string, changes: Partial<Post>) => void;
}

/**
 * One formatter per locale, kept.
 *
 * `toLocaleDateString` looks free and is not: on Hermes each call builds an
 * `Intl.DateTimeFormat` from scratch, and a screen of twenty rows built twenty
 * of them on every render. Constructing the formatter is the expensive half;
 * `format` on a kept one is cheap.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatPostDate(iso: string, locale: string): string {
    let formatter = formatters.get(locale);

    if (!formatter) {
        // Day and month. A year is noise on a feed where almost everything is
        // from this week, and the full date is on the detail screen.
        formatter = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
        });
        formatters.set(locale, formatter);
    }

    return formatter.format(new Date(iso));
}

/**
 * One row of the feed.
 *
 * Liking, saving and sharing work. The comment and quote counts are still
 * numbers rather than buttons — opening the post is PR 10, quoting it is PR 12
 * — and they stay plain views rather than disabled `Pressable`s, because a
 * button that answers a tap with nothing reads as broken where a number reads
 * as a number.
 *
 * `mentions` therefore flows through as ordinary text. PR 24 brings the
 * renderer that turns `@ada` into something you can press.
 */
function PostCardView({ onUpdated, onPatch, ...post }: PostCardProps) {
    const { t, locale } = useI18n();
    const date = formatPostDate(post.createdAt, locale);
    const { refresh, isRefreshing } = usePendingMedia({
        postId: post.id,
        mediaPending: post.mediaPending,
        onUpdated,
    });
    const { handleLike, isLikeLoading, handleBookmark, handleShare } =
        usePostActions({ post, onPatch: onPatch ?? noPatch });

    return (
        <View className="flex-row gap-3 border-b border-ink/10 px-4 py-4">
            {/*
             * `avatarUrl` is NOT NULL in the database and the mapper
             * substitutes a CDN default, so there is nothing to fall back to
             * and nothing to sanitise.
             */}
            <Avatar uri={post.author.avatarUrl} size={40} />

            <View className="flex-1 gap-2">
                <View className="flex-row items-center gap-1.5">
                    {post.author.fullName && (
                        <Text
                            size="small"
                            numberOfLines={1}
                            className="shrink font-semibold"
                        >
                            {post.author.fullName}
                        </Text>
                    )}
                    <Text
                        size="small"
                        tone="subtle"
                        numberOfLines={1}
                        className="shrink"
                    >
                        @{post.author.username}
                    </Text>
                    <Text size="small" tone="subtle">
                        ·
                    </Text>
                    <Text size="small" tone="subtle">
                        {date}
                    </Text>

                    {/*
                     * The API's own vocabulary, spaced out — the web prints it
                     * the same way. Translating it would mean five keys per
                     * language for a label that names a database enum, and a
                     * post type that reads differently in two places is worse
                     * than one that reads bluntly in both.
                     */}
                    <View className="ml-auto rounded-full border border-ink/20 bg-ink/5 px-2 py-0.5">
                        <Text
                            size="caption"
                            tone="muted"
                            className="text-[9px] font-bold tracking-wider"
                        >
                            {post.type.replace("_", " ")}
                        </Text>
                    </View>
                </View>

                {post.content.length > 0 && <Text>{post.content}</Text>}

                {/*
                 * Both, never one or the other by construction: a post whose
                 * video is still being checked arrives with `mediaUrls: []`,
                 * so the placeholder stands alone until it resolves — and a
                 * post with a picture *and* a pending video shows the picture
                 * with the wait beneath it.
                 */}
                {post.mediaPending && (
                    <PendingMedia
                        onRefresh={onUpdated ? () => void refresh() : undefined}
                        isRefreshing={isRefreshing}
                    />
                )}

                {post.mediaUrls.length > 0 && (
                    <SensitiveMedia isSensitive={post.isSensitive}>
                        <PostMedia uris={post.mediaUrls} />
                    </SensitiveMedia>
                )}

                <View className="flex-row items-center gap-5 pt-1">
                    <Counter icon={CommentIcon} count={post.commentCount} />
                    <Counter icon={QuoteIcon} count={post.quoteCount} />

                    <Action
                        icon={LikeIcon}
                        count={post.likeCount}
                        isActive={post.isLiked}
                        activeClassName="text-like"
                        disabled={isLikeLoading || !onPatch}
                        label={t("post.like")}
                        onPress={() => void handleLike()}
                    />

                    <Action
                        icon={BookmarkIcon}
                        isActive={post.isBookmarked}
                        activeClassName="text-accent"
                        disabled={!onPatch}
                        label={t("post.bookmark")}
                        onPress={() => void handleBookmark()}
                    />

                    <Action
                        icon={ShareIcon}
                        isActive={false}
                        label={t("post.share")}
                        onPress={() => void handleShare()}
                    />
                </View>
            </View>
        </View>
    );
}

/**
 * Memoised, and it earns it here rather than by habit.
 *
 * A row's props are a `Post` the list holds by reference, so they change only
 * when that post does. Without this, anything that re-renders the screen —
 * a page arriving, the refresh spinner starting, a tab changing — rebuilt
 * every visible row along with it.
 */
export const PostCard = memo(PostCardView);

/** Somewhere for the hook's writes to go when the card has no owner. */
const noPatch = () => {};

/**
 * A control, and the number beside it when there is one.
 *
 * `hitSlop` rather than a bigger box: five of these share the width the avatar
 * leaves, so the tap target has to grow outside the layout rather than inside
 * it. Below about 44px a thumb misses.
 */
function Action({
    icon: Icon,
    count,
    isActive,
    activeClassName = "text-ink",
    disabled,
    label,
    onPress,
}: {
    icon: LucideIcon;
    count?: number;
    isActive: boolean;
    /** The role this control wears when it is on. */
    activeClassName?: string;
    disabled?: boolean;
    label: string;
    onPress: () => void;
}) {
    const tone = isActive ? activeClassName : "text-ink/40";

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: !!disabled }}
            accessibilityLabel={label}
            disabled={disabled}
            onPress={onPress}
            hitSlop={10}
            className="flex-row items-center gap-1.5"
        >
            {/*
             * Filled as well as tinted, which is what the web does — the shape
             * carries the state where the colour cannot, for anyone who does
             * not separate pink from blue.
             *
             * The two roles are the web's own hues: a liked heart is `like`
             * (its `pink-500`) and a saved post is `accent` (its `blue-400`).
             * `like` exists as a role for this one control; `tailwind.config`
             * says why a colour named after a feature earned its place there.
             */}
            <Icon
                size={16}
                className={tone}
                fill={isActive ? "currentColor" : "none"}
            />
            {count !== undefined && (
                <Text size="small" tone="subtle" className={tone}>
                    {count}
                </Text>
            )}
        </Pressable>
    );
}

function Counter({ icon: Icon, count }: { icon: LucideIcon; count: number }) {
    return (
        <View className="flex-row items-center gap-1.5">
            <Icon size={16} className="text-ink/40" />
            <Text size="small" tone="subtle">
                {count}
            </Text>
        </View>
    );
}
