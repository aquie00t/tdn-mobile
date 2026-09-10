import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import { PendingMedia } from "@shared/ui/PendingMedia";
import { PostMedia } from "@shared/ui/PostMedia";
import { RichText } from "@shared/ui/RichText";
import type { QuotedPost } from "../../data/feed.types";
import { SensitiveMedia } from "@shared/ui/SensitiveMedia";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface QuotedPostCardProps {
    post: QuotedPost;
    /**
     * Set on the preview inside the composer, where the card is context for
     * what is about to be written rather than something to open.
     */
    isPreview?: boolean;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatQuotedDate(iso: string, locale: string): string {
    let formatter = formatters.get(locale);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
        });
        formatters.set(locale, formatter);
    }

    return formatter.format(new Date(iso));
}

/**
 * The post embedded inside a quote.
 *
 * Three limits come straight from the payload and shape the whole component.
 * `QuotedPost` carries no counters and no `isLiked`/`isBookmarked`, so there is
 * nothing to act on and no action row. It carries no `quotedPost` of its own,
 * so this never nests — the embedded card is always exactly one level deep,
 * whatever the quote is quoting. And it carries no `mentions`, so `@ada` in the
 * body stays plain text: passing the *quoting* post's list would resolve the
 * wrong body's names.
 */
export function QuotedPostCard({
    post,
    isPreview = false,
}: QuotedPostCardProps) {
    const { locale } = useI18n();
    const router = useRouter();

    const open = () =>
        router.push({ pathname: "/post/[id]", params: { id: post.id } });

    const Card = isPreview ? View : Pressable;

    return (
        <Card
            // The card sits inside a `PostCard` that opens on press. React
            // Native gives the tap to the innermost pressable, which is what
            // lets this one reach the original rather than the quote.
            {...(isPreview
                ? {}
                : { accessibilityRole: "button" as const, onPress: open })}
            /*
             * A real surface rather than a 2% wash. The web's `bg-ink/[0.02]`
             * reads as a card in a 600px column with a hover state under a
             * cursor; on a phone, inside a row that is already indented past
             * an avatar, it is a border with nothing behind it. `surface-1` is
             * the role for a panel raised off the ground and says plainly that
             * this is a different post.
             */
            className="gap-2 rounded-2xl border border-ink/15 bg-surface-1 p-3.5"
        >
            <View className="flex-row items-center gap-2">
                <Avatar uri={post.author.avatarUrl} size={24} />

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
                    {formatQuotedDate(post.createdAt, locale)}
                </Text>
            </View>

            {/*
             * Full `ink`, not the web's `text-ink/70`. That fade is readable
             * beside a wide body at desktop sizes; at phone width it turns the
             * quoted post into something the eye skips, which is the opposite
             * of what a quote is for.
             */}
            {post.content.length > 0 && (
                <RichText text={post.content} size="small" />
            )}

            {/*
             * No refresh offered. The embedded card reads a post this screen
             * does not own, so there is nowhere to put a re-read answer — it
             * shows the wait without pretending it can end it.
             */}
            {post.mediaPending && <PendingMedia />}

            {post.mediaUrls.length > 0 && (
                /*
                 * `post.isSensitive` — the **quoted** post's own flag, never
                 * the quoting post's.
                 *
                 * Getting this wrong turns quoting into the way around the
                 * filter: quote something flagged, and a cover that reads the
                 * quoter's flag leaves it uncovered. It is also the kind of
                 * mistake that ships unnoticed, because moderation is
                 * currently disabled on the API and nothing arrives flagged at
                 * all.
                 */
                <SensitiveMedia isSensitive={post.isSensitive}>
                    <PostMedia uris={post.mediaUrls} isEmbedded />
                </SensitiveMedia>
            )}
        </Card>
    );
}
