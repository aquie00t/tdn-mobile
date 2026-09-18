import { FlatList, Pressable, View } from "react-native";
import { useCallback } from "react";
import { useRouter } from "expo-router";

import { ArticleCard } from "./ArticleCard";
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

/**
 * Everything published, newest first.
 *
 * A component rather than a screen, because it is drawn *inside* the feed —
 * the web keeps articles as the fourth tab of its strip, and the tab bar here
 * has no room for a sixth entry. The route hands this to `FeedScreen` as a
 * node, which is what keeps the feed from importing this feature.
 */
export function ArticleList() {
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
    } = useArticles();

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
    const write = (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("editor.writeArticle")}
            onPress={() => router.push("/articles/new")}
            className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-ink active:bg-ink-hover"
            style={{ elevation: 6 }}
        >
            <CreateIcon size={26} className="text-ground" />
        </Pressable>
    );

    if (isLoading) return <Spinner center />;

    /*
     * The error state replaces the list only while it is empty. A page that
     * failed under rows that are already up belongs beneath them: a second
     * page that never arrived must not take the first one with it.
     */
    if (error && articles.length === 0) {
        return (
            <View className="flex-1">
                <ErrorState
                    message={error}
                    onRetry={() => void retry()}
                    retryLabel={t("postList.tryAgain")}
                />
                {write}
            </View>
        );
    }

    return (
        <View className="flex-1">
            <FlatList
                data={articles}
                keyExtractor={keyOf}
                renderItem={renderItem}
                onEndReached={hasMore ? reachEnd : undefined}
                onEndReachedThreshold={0.5}
                // The same two as every other list here: the defaults keep ten
                // screenfuls either side mounted, and all of them repaint on a
                // theme change.
                windowSize={7}
                maxToRenderPerBatch={5}
                ListEmptyComponent={
                    <EmptyState
                        title={t("article.empty")}
                        description={t("article.emptyHint")}
                    />
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
