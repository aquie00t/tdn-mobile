import { FlatList, Pressable, View } from "react-native";
import { useCallback } from "react";
import type { ReactElement } from "react";
import { useRouter } from "expo-router";

import { ArticleCard } from "./ArticleCard";
import type { ArticleQuery } from "../hooks/useArticles";
import type { ArticleSummary } from "../../data/article.types";
import { Button } from "@shared/ui/Button";
import { CreateIcon } from "@shared/ui/icons/lucide";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { readerFacingMessage } from "@shared/utils/report-error";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useArticles } from "../hooks/useArticles";
import { useI18n } from "@shared/hooks/useI18n";

const keyOf = (article: ArticleSummary) => article.id;

export interface ArticleListProps {
    /** Which articles; everything published when absent. */
    query?: ArticleQuery;
    /**
     * Drawn above the rows and scrolled with them — a profile's header, which
     * has to move with its articles rather than sit over them as a second
     * scroller. With one, loading and failure are drawn *under* it rather
     * than in its place, so the profile does not blink out while a page loads.
     */
    header?: ReactElement;
    /** Whether the write button floats over the list. */
    showWrite?: boolean;
    /** What an empty list says. The feed's own words when absent. */
    emptyTitle?: string;
    emptyHint?: string;
}

/**
 * A list of articles, newest first.
 *
 * A component rather than a screen, because it is drawn *inside* others — the
 * feed's Articles tab, and a profile's. The routes hand it over as a node,
 * which is what keeps the feed and the profile from importing this feature.
 */
export function ArticleList({
    query,
    header,
    showWrite = true,
    emptyTitle,
    emptyHint,
}: ArticleListProps) {
    const { t } = useI18n();
    const router = useRouter();
    const {
        articles,
        isLoading,
        isLoadingMore,
        error,
        loadMoreError,
        hasMore,
        retry,
        loadMore,
    } = useArticles(query);

    // No copy is handed back: what the reader changes lives in the overlay,
    // which the card reads for itself. See `article-overlay.store`.
    const renderItem = useCallback(
        ({ item }: { item: ArticleSummary }) => <ArticleCard article={item} />,
        [],
    );

    const reachEnd = useCallback(() => {
        void loadMore();
    }, [loadMore]);

    /*
     * The feed's write button, in the place the reader already knows. It opens
     * the article editor here rather than the post composer: articles have no
     * inline box on the web either, only a way in to a page of their own.
     */
    const write = showWrite ? (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("editor.writeArticle")}
            onPress={() => router.push("/articles/new")}
            className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-ink active:bg-ink-hover"
            style={{ elevation: 6 }}
        >
            <CreateIcon size={26} className="text-ground" />
        </Pressable>
    ) : null;

    /*
     * The error state replaces the rows only while there are none. A page that
     * failed under rows that are already up belongs beneath them: a second
     * page that never arrived must not take the first one with it.
     */
    const failed = error !== null && articles.length === 0;
    const failure = failed ? (
        <ErrorState
            message={error}
            onRetry={() => void retry()}
            retryLabel={t("postList.tryAgain")}
        />
    ) : null;

    if (!header) {
        if (isLoading) return <Spinner center />;
        if (failed) {
            return (
                <View className="flex-1">
                    {failure}
                    {write}
                </View>
            );
        }
    }

    return (
        <View className="flex-1">
            <FlatList
                data={isLoading ? [] : articles}
                keyExtractor={keyOf}
                renderItem={renderItem}
                onEndReached={hasMore ? reachEnd : undefined}
                onEndReachedThreshold={0.5}
                // The same two as every other list here: the defaults keep ten
                // screenfuls either side mounted, and all of them repaint on a
                // theme change.
                windowSize={7}
                maxToRenderPerBatch={5}
                ListHeaderComponent={
                    header ? (
                        <>
                            {header}
                            {isLoading ? (
                                <View className="py-8">
                                    <Spinner />
                                </View>
                            ) : (
                                failure
                            )}
                        </>
                    ) : undefined
                }
                ListEmptyComponent={
                    isLoading || failed ? null : (
                        <EmptyState
                            title={emptyTitle ?? t("article.empty")}
                            description={
                                emptyTitle ? emptyHint : t("article.emptyHint")
                            }
                        />
                    )
                }
                ListFooterComponent={
                    isLoadingMore ? (
                        <View className="py-6">
                            <Spinner />
                        </View>
                    ) : loadMoreError ? (
                        <View className="items-center gap-2 py-4">
                            <Text size="caption" tone="subtle">
                                {readerFacingMessage(loadMoreError)}
                            </Text>
                            <Button
                                label={t("postList.tryAgain")}
                                size="sm"
                                variant="outline"
                                onPress={() => void loadMore()}
                            />
                        </View>
                    ) : articles.length > 0 && !hasMore ? (
                        <View className="items-center py-6">
                            <Text size="caption" tone="subtle">
                                {t("article.noMore")}
                            </Text>
                        </View>
                    ) : null
                }
            />
            {write}
        </View>
    );
}
