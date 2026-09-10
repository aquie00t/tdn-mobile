import { View } from "react-native";
import { memo } from "react";

import { Avatar } from "@shared/ui/Avatar";
import { CommentIcon, LikeIcon, QuoteIcon } from "@shared/ui/icons/lucide";
import type { LucideIcon } from "lucide-react-native";
import { PendingMedia } from "@shared/ui/PendingMedia";
import type { Post } from "../../data/feed.types";
import { PostMedia } from "@shared/ui/PostMedia";
import { SensitiveMedia } from "@shared/ui/SensitiveMedia";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { usePendingMedia } from "../hooks/usePendingMedia";

export interface PostCardProps extends Post {
    /**
     * Handed a freshly read copy of this post when its pending video resolves.
     * Without one there is nowhere to put the answer, so the placeholder shows
     * the wait but offers no way to end it.
     */
    onUpdated?: (post: Post) => void;
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
 * The counters are numbers rather than buttons, and that is still this card's
 * boundary: liking and bookmarking land in PR 9, the quoted card in PR 12, and
 * opening the post in PR 10. They are drawn as plain views rather than
 * disabled `Pressable`s on purpose — a button that answers a tap with nothing
 * reads as broken, where a number reads as a number.
 *
 * Media is no longer among them. The block below renders attachments, covers
 * the ones the server flagged, and stands in for a video still being checked.
 *
 * `mentions` therefore flows through as ordinary text. PR 24 brings the
 * renderer that turns `@ada` into something you can press.
 */
function PostCardView({ onUpdated, ...post }: PostCardProps) {
    const { locale } = useI18n();
    const date = formatPostDate(post.createdAt, locale);
    const { refresh, isRefreshing } = usePendingMedia({
        postId: post.id,
        mediaPending: post.mediaPending,
        onUpdated,
    });

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

                <View className="flex-row items-center gap-6 pt-1">
                    <Counter icon={CommentIcon} count={post.commentCount} />
                    <Counter icon={LikeIcon} count={post.likeCount} />
                    <Counter icon={QuoteIcon} count={post.quoteCount} />
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
