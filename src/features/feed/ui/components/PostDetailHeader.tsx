import { View } from "react-native";

import type { Post } from "../../data/feed.types";
import { PostCard } from "./PostCard";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface PostDetailHeaderProps {
    post: Post;
    /** Handed a re-read copy when the post's pending video resolves. */
    onUpdated?: (post: Post) => void;
}

/**
 * The post, at the top of its own thread.
 *
 * The same card the feed draws, with two differences: it does not open
 * anything when pressed — it is already the whole screen — and it carries the
 * full timestamp underneath. The feed's day-and-month is right for scanning a
 * list; on the one post somebody chose to open, the hour is worth having.
 *
 * Presentational: the post is handed in rather than fetched, because the route
 * above needs it too — that is where a new comment moves the count.
 */
export function PostDetailHeader({ post, onUpdated }: PostDetailHeaderProps) {
    const { locale } = useI18n();

    const stamp = new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeStyle: "short",
    }).format(new Date(post.createdAt));

    return (
        <View className="border-b border-ink/10">
            <PostCard
                {...post}
                isPressable={false}
                hasDivider={false}
                onUpdated={onUpdated}
            />
            <View className="px-4 pb-4">
                <Text size="caption" tone="subtle">
                    {stamp}
                </Text>
            </View>
        </View>
    );
}
