import { Image } from "expo-image";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import type { Article, ArticleSummary } from "../../data/article.types";
import { Avatar } from "@shared/ui/Avatar";
import { BookmarkIcon, LikeIcon, ProfileIcon } from "@shared/ui/icons/lucide";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { getSafeMediaUri } from "@shared/utils/media-uri";
import { MarkdownBody } from "../components/MarkdownBody";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { SensitiveMedia } from "@shared/ui/SensitiveMedia";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useArticle } from "../hooks/useArticle";
import { useArticleActions } from "../hooks/useArticleActions";
import {
    useArticleOverlayStore,
    withOverlay,
} from "../store/article-overlay.store";
import { useI18n } from "@shared/hooks/useI18n";

export interface ArticleScreenProps {
    slug: string;
}

const COVER = { width: "100%", height: "100%" } as const;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatWhen(iso: string, locale: string): string {
    let formatter = formatters.get(locale);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
        formatters.set(locale, formatter);
    }

    return formatter.format(new Date(iso));
}

/**
 * Reading one article.
 *
 * The header is deliberately bare — the title belongs in the page, at the size
 * the author wrote it, rather than squeezed into a bar at `lead` and cut with
 * an ellipsis. What the bar carries is the way back and the two marks.
 *
 * Comments are not here. An article takes them, and the comment feature
 * already knows how to hang off one, but the thread has no route of its own
 * yet; it is a step rather than an omission.
 */
export function ArticleScreen({ slug }: ArticleScreenProps) {
    const { t, locale } = useI18n();
    const router = useRouter();
    const {
        article: fromServer,
        isLoading,
        error,
        notFound,
        retry,
    } = useArticle(slug);

    /*
     * The same overlay the list's cards read, so a like made here shows on the
     * row behind this screen rather than only until it is left.
     */
    const patch = useArticleOverlayStore((s) => s.patch);
    const overlay = useArticleOverlayStore((s) =>
        fromServer ? s.overlays[fromServer.id] : undefined,
    );
    /*
     * `withOverlay<Article>` rather than letting it infer: the overlay is
     * typed on `ArticleSummary` — the half the card and this screen share —
     * and inference would narrow the result to that, taking `body` with it.
     */
    const article = fromServer
        ? withOverlay<Article>(fromServer, overlay)
        : null;

    const { toggleLike, toggleBookmark } = useArticleActions({
        // Before the first read lands there is nothing to act on, and the
        // controls are not drawn — this only satisfies the hook's shape.
        article: article ?? EMPTY,
        onChange: (changes) => {
            if (article) patch(article.id, changes);
        },
    });

    const cover = article?.coverImageUrl
        ? getSafeMediaUri(article.coverImageUrl)
        : null;

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader
                /*
                 * Deliberately empty. The title belongs in the page, at the
                 * size the author wrote it, rather than squeezed into a bar at
                 * `lead` and cut with an ellipsis — so the bar carries the way
                 * back and the two marks, and nothing else.
                 */
                title=""
                right={
                    article ? (
                        <View className="flex-row items-center gap-1 pr-1">
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("article.like")}
                                accessibilityState={{
                                    selected: article.isLiked,
                                }}
                                onPress={() => void toggleLike()}
                                hitSlop={8}
                                className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
                            >
                                <LikeIcon
                                    size={19}
                                    className={
                                        article.isLiked
                                            ? "text-danger"
                                            : "text-ink/50"
                                    }
                                />
                            </Pressable>

                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("article.bookmark")}
                                accessibilityState={{
                                    selected: article.isBookmarked,
                                }}
                                onPress={() => void toggleBookmark()}
                                hitSlop={8}
                                className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
                            >
                                <BookmarkIcon
                                    size={19}
                                    className={
                                        article.isBookmarked
                                            ? "text-accent"
                                            : "text-ink/50"
                                    }
                                />
                            </Pressable>
                        </View>
                    ) : undefined
                }
            />

            {isLoading ? (
                <Spinner center />
            ) : notFound ? (
                /*
                 * A draft belonging to somebody else answers 404 as surely as
                 * an article that never existed, and this says the same thing
                 * for both — telling them apart would hand back exactly what
                 * the status code withholds.
                 */
                <EmptyState
                    title={t("article.notFound")}
                    description={t("article.notFoundHint")}
                />
            ) : error || !article ? (
                <ErrorState
                    message={error ?? ""}
                    onRetry={() => void retry()}
                    retryLabel={t("postList.tryAgain")}
                />
            ) : (
                <ScrollView className="flex-1">
                    {cover && (
                        <SensitiveMedia isSensitive={article.isSensitive}>
                            <View className="aspect-[16/9] bg-surface-2">
                                <Image
                                    source={{ uri: cover }}
                                    style={COVER}
                                    contentFit="cover"
                                    transition={150}
                                    alt={article.coverImageAlt ?? ""}
                                />
                            </View>
                        </SensitiveMedia>
                    )}

                    <View className="gap-3 px-4 pt-5">
                        <Text size="display" className="leading-9">
                            {article.title}
                        </Text>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={article.author.username}
                            onPress={() =>
                                router.push({
                                    pathname: "/profile/[username]",
                                    params: {
                                        username: article.author.username,
                                    },
                                })
                            }
                            className="flex-row items-center gap-2.5 py-1"
                        >
                            {article.author.avatarUrl ? (
                                <Avatar
                                    uri={article.author.avatarUrl}
                                    size={32}
                                />
                            ) : (
                                <View className="h-8 w-8 items-center justify-center rounded-full border border-ink/10 bg-surface-2">
                                    <ProfileIcon
                                        size={16}
                                        className="text-ink/40"
                                    />
                                </View>
                            )}

                            <View className="min-w-0 flex-1">
                                <Text size="small" numberOfLines={1}>
                                    {article.author.fullName ||
                                        article.author.username}
                                </Text>
                                <Text size="caption" tone="subtle">
                                    {[
                                        article.publishedAt
                                            ? formatWhen(
                                                  article.publishedAt,
                                                  locale,
                                              )
                                            : null,
                                        t("article.readingTime", {
                                            n: article.readingTimeMinutes,
                                        }),
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </Text>
                            </View>
                        </Pressable>
                    </View>

                    <MarkdownBody
                        body={article.body}
                        mentions={article.mentions}
                    />

                    {article.tags.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 px-4 pb-10">
                            {article.tags.map((tag) => (
                                <Pressable
                                    key={tag.name}
                                    accessibilityRole="button"
                                    accessibilityLabel={`#${tag.name}`}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/tag/[tag]",
                                            params: { tag: tag.name },
                                        })
                                    }
                                    className="rounded-full border border-ink/15 px-3 py-1.5 active:bg-ink/5"
                                >
                                    <Text size="caption" tone="muted">
                                        #{tag.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
        </Screen>
    );
}

/**
 * Stands in until the article arrives, so the actions hook has the shape it
 * takes. Nothing reads it — the controls it belongs to are not drawn until
 * there is a real one.
 */
const EMPTY: ArticleSummary = {
    id: "",
    slug: "",
    title: "",
    excerpt: "",
    coverImageUrl: null,
    coverImageAlt: null,
    isSensitive: false,
    readingTimeMinutes: 0,
    likeCount: 0,
    commentCount: 0,
    isLiked: false,
    isBookmarked: false,
    status: "PUBLISHED",
    publishedAt: null,
    createdAt: "",
    author: { id: "", username: "", avatarUrl: "" },
    tags: [],
    mentions: [],
    categories: [],
};
