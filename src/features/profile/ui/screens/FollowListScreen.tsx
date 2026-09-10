import { FlatList, View } from "react-native";
import { useCallback } from "react";

import { Button } from "@shared/ui/Button";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import type { FollowListType, FollowUser } from "../../data/profile.types";
import { FollowRow } from "../components/FollowRow";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { useFollowList } from "../hooks/useFollowList";
import { useI18n } from "@shared/hooks/useI18n";

const keyOf = (user: FollowUser) => user.userId;

export interface FollowListScreenProps {
    username: string;
    type: FollowListType;
}

/**
 * Who follows an account, or who it follows.
 *
 * One screen for both sides rather than two: the rows are identical, the
 * endpoints take the same shape, and the only difference is which one is read
 * and what the header says.
 */
export function FollowListScreen({ username, type }: FollowListScreenProps) {
    const { t } = useI18n();
    const {
        users,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        patchUser,
    } = useFollowList(username, type);

    const renderItem = useCallback(
        ({ item }: { item: FollowUser }) => (
            <FollowRow user={item} onPatch={patchUser} />
        ),
        [patchUser],
    );

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader
                title={t(
                    type === "followers"
                        ? "profile.followers"
                        : "profile.followingCount",
                )}
            />

            {isLoading ? (
                <Spinner center />
            ) : error ? (
                <ErrorState message={error} />
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={keyOf}
                    renderItem={renderItem}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        <EmptyState title={t("follows.emptyTitle")} />
                    }
                    ListFooterComponent={
                        isLoadingMore ? (
                            <View className="py-6">
                                <Spinner />
                            </View>
                        ) : hasMore ? (
                            <View className="items-center py-4">
                                <Button
                                    label={t("common.loadMore")}
                                    size="sm"
                                    variant="outline"
                                    onPress={loadMore}
                                />
                            </View>
                        ) : null
                    }
                />
            )}
        </Screen>
    );
}
