import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { memo } from "react";
import { useRouter } from "expo-router";

import type { ArticleSummary } from "../../data/article.types";
import { Avatar } from "@shared/ui/Avatar";
import { BookmarkIcon, LikeIcon, ProfileIcon } from "@shared/ui/icons/lucide";
import { getSafeMediaUri } from "@shared/utils/media-uri";
import { SensitiveMedia } from "@shared/ui/SensitiveMedia";
import { Text } from "@shared/ui/Text";
import { useArticleActions } from "../hooks/useArticleActions";
import {
    useArticleOverlayStore,
    withOverlay,
} from "../store/article-overlay.store";
import { useI18n } from "@shared/hooks/useI18n";

export interface ArticleCardProps {
    /** As the server last sent it. What the reader has changed is laid over. */
    article: ArticleSummary;
}

const COVER = { width: "100%", height: "100%" } as const;

/**
 * One article in the list.
 *
 * The **excerpt**, never the body: the list endpoint omits `body` on purpose,
 * because one runs to a hundred thousand characters and a page of twenty would
 * be megabytes of markdown. Reaching for it here yields `undefined`, not a
 * short string.
 *
 * Opening takes the **slug**; liking and saving take the **id**. They are not
 * interchangeable and both are on the row.
 */
function ArticleCardView({ article: fromServer }: ArticleCardProps) {
    const { t } = useI18n();
    const router = useRouter();

    /*
     * Two problems, one seam. A `FlatList` row is unmounted as it leaves the
     * window and mounted again on the way back, so a card holding its own
     * `isLiked` would lose it while scrolling; and the same article is on two
     * screens at once, so a like made while reading has to show on the row
     * behind it. The overlay answers both — `create-overlay-store` has the
     * full reasoning.
     */
    const patch = useArticleOverlayStore((s) => s.patch);
    const overlay = useArticleOverlayStore((s) => s.overlays[fromServer.id]);
    const article = withOverlay(fromServer, overlay);

    const { toggleLike, toggleBookmark } = useArticleActions({
        article,
        onChange: (changes) => patch(article.id, changes),
    });

    const cover = article.coverImageUrl
        ? getSafeMediaUri(article.coverImageUrl)
        : null;

    /*
     * Only the author's own list carries anything but published rows. A draft
     * opens where it is finished rather than where it would be read, and
     * neither a draft nor an archived article takes a like or a save — nobody
     * else can see one to agree with it.
     */
    const isPublished = article.status === "PUBLISHED";
    const isDraft = article.status === "DRAFT";

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={article.title}
            onPress={() =>
                router.push({
                    pathname: isDraft
                        ? "/articles/[slug]/edit"
                        : "/articles/[slug]",
                    params: { slug: article.slug },
                })
            }
            className="gap-3 border-b border-ink/10 px-4 py-4 active:bg-ink/5"
        >
            {cover && (
                <SensitiveMedia isSensitive={article.isSensitive}>
                    <View className="aspect-[16/9] overflow-hidden rounded-2xl border border-ink/10 bg-surface-2">
                        <Image
                            source={{ uri: cover }}
                            style={COVER}
                            contentFit="cover"
                            transition={150}
                            // The author's description of their own cover, and
                            // the only thing a screen reader has for it.
                            alt={article.coverImageAlt ?? ""}
                        />
                    </View>
                </SensitiveMedia>
            )}

            <View className="gap-1.5">
                {!isPublished && (
                    <View className="self-start rounded-full border border-ink/15 px-2 py-0.5">
                        <Text
                            size="caption"
                            tone="subtle"
                            className="font-semibold uppercase"
                        >
                            {t(
                                isDraft
                                    ? "editor.statusDraft"
                                    : "editor.statusArchived",
                            )}
                        </Text>
                    </View>
                )}
                <Text size="lead" numberOfLines={2} className="font-bold">
                    {article.title}
                </Text>
                {article.excerpt ? (
                    <Text size="small" tone="muted" numberOfLines={3}>
                        {article.excerpt}
                    </Text>
                ) : null}
            </View>

            <View className="flex-row items-center gap-2">
                {article.author.avatarUrl ? (
                    <Avatar uri={article.author.avatarUrl} size={24} />
                ) : (
                    <View className="h-6 w-6 items-center justify-center rounded-full border border-ink/10 bg-surface-2">
                        <ProfileIcon size={12} className="text-ink/40" />
                    </View>
                )}

                <Text size="caption" tone="subtle" numberOfLines={1}>
                    {article.author.fullName || article.author.username}
                </Text>

                <Text size="caption" tone="subtle">
                    ·
                </Text>

                <Text size="caption" tone="subtle" className="flex-1">
                    {t("article.readingTime", {
                        n: article.readingTimeMinutes,
                    })}
                </Text>

                {isPublished && (
                    <>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("article.like")}
                            accessibilityState={{ selected: article.isLiked }}
                            onPress={() => void toggleLike()}
                            hitSlop={8}
                            className="flex-row items-center gap-1 px-1"
                        >
                            <LikeIcon
                                size={15}
                                className={
                                    article.isLiked
                                        ? "text-danger"
                                        : "text-ink/40"
                                }
                            />
                            {article.likeCount > 0 && (
                                <Text size="caption" tone="subtle">
                                    {article.likeCount}
                                </Text>
                            )}
                        </Pressable>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("article.bookmark")}
                            accessibilityState={{
                                selected: article.isBookmarked,
                            }}
                            onPress={() => void toggleBookmark()}
                            hitSlop={8}
                            className="px-1"
                        >
                            <BookmarkIcon
                                size={15}
                                className={
                                    article.isBookmarked
                                        ? "text-accent"
                                        : "text-ink/40"
                                }
                            />
                        </Pressable>
                    </>
                )}
            </View>
        </Pressable>
    );
}

/**
 * Memoised because a list re-renders for reasons that have nothing to do with
 * any one row — the same reason the feed's card is. The overlay is subscribed
 * to per row, so a like still repaints exactly the row it was made on.
 */
export const ArticleCard = memo(ArticleCardView);
