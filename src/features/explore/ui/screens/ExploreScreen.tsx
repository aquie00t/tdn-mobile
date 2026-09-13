import { ScrollView, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

import { AccountResultRow } from "../components/AccountResultRow";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { SearchField } from "../components/SearchField";
import { Screen } from "@shared/ui/Screen";
import { Spinner } from "@shared/ui/Spinner";
import { TagResultRow } from "../components/TagResultRow";
import { Text } from "@shared/ui/Text";
import { TrendCard } from "../components/TrendCard";
import { TrendIcon } from "@shared/ui/icons/lucide";
import { SEARCH_MIN_CHARS, useTagSearch } from "../hooks/useTagSearch";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useI18n } from "@shared/hooks/useI18n";
import { useProfileSearch } from "../hooks/useProfileSearch";
import { useTrends } from "../hooks/useTrends";

/**
 * Long enough that a word is finished, short enough that nobody waits for it.
 * The web uses the same 300ms in both of its search hooks.
 */
const DEBOUNCE_MS = 300;

/**
 * Trends, and the app's one search box.
 *
 * **One box, two searches.** The web searches tags here and accounts from a
 * dropdown in its header; a phone has no header, so both live on this screen
 * and the same query drives them. Results arrive in two sections — accounts
 * first, because somebody typing a name is looking for a person more often
 * than for a topic.
 *
 * **Results replace the grid rather than floating over it.** The web opens a
 * dropdown and then has to listen for clicks outside it to know when to close.
 * Here, an empty box *is* the closed state: clear it and the trends are back.
 */
export function ExploreScreen() {
    const { t } = useI18n();
    const router = useRouter();

    const [query, setQuery] = useState("");
    /*
     * Trimmed before it is debounced, so one value decides everything: what is
     * searched, whether results are shown, and what the empty state quotes
     * back. Trimming only at the display end would fire a request for "  a"
     * while the screen was still showing trends.
     */
    const trimmed = query.trim();
    const settled = useDebouncedValue(trimmed, DEBOUNCE_MS);

    const trends = useTrends();
    const tags = useTagSearch(settled);
    const accounts = useProfileSearch(settled);

    const isSearching = trimmed.length >= SEARCH_MIN_CHARS;

    /*
     * Still typing counts as loading. Without the first half, the spinner only
     * appears once the debounce has already elapsed — so the box sits
     * unresponsive for the third of a second that matters most.
     */
    const isBusy =
        isSearching &&
        (trimmed !== settled || tags.isLoading || accounts.isLoading);

    const openTag = (tag: string) =>
        router.push({ pathname: "/tag/[tag]", params: { tag } });

    const openProfile = (username: string) =>
        router.push({ pathname: "/profile/[username]", params: { username } });

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <View className="gap-3 px-4 pb-3 pt-2">
                <Text size="title">{t("explore.title")}</Text>
                <SearchField
                    value={query}
                    onChange={setQuery}
                    isSearching={isBusy}
                />
            </View>

            {isSearching ? (
                <Results
                    accounts={accounts}
                    tags={tags}
                    isBusy={isBusy}
                    query={settled}
                    onOpenTag={openTag}
                    onOpenProfile={openProfile}
                />
            ) : (
                <Trending state={trends} onOpenTag={openTag} />
            )}
        </Screen>
    );
}

interface TrendingProps {
    state: ReturnType<typeof useTrends>;
    onOpenTag: (tag: string) => void;
}

function Trending({ state, onOpenTag }: TrendingProps) {
    const { t } = useI18n();

    if (state.isLoading) return <Spinner center />;

    if (state.error) {
        return (
            <ErrorState
                message={state.error}
                onRetry={state.retry}
                retryLabel={t("postList.tryAgain")}
            />
        );
    }

    if (state.trends.length === 0) {
        return <EmptyState title={t("trending.empty")} />;
    }

    return (
        <ScrollView contentContainerClassName="gap-3 px-4 pb-8">
            <View className="flex-row items-center gap-2">
                <TrendIcon size={16} className="text-ink/50" />
                <Text className="font-semibold">
                    {t("explore.trendingTopics")}
                </Text>
                <Text size="caption" tone="subtle">
                    · {t("explore.lastDays")}
                </Text>
            </View>

            {/* A wrapping row rather than a `FlatList` with two columns: the
                whole grid is one page of tiles, and a virtualised list inside
                a scroll view is the arrangement React Native warns about. */}
            <View className="flex-row flex-wrap gap-3">
                {state.trends.map((trend) => (
                    <TrendCard
                        key={trend.tag}
                        trend={trend}
                        onPress={onOpenTag}
                    />
                ))}
            </View>
        </ScrollView>
    );
}

interface ResultsProps {
    accounts: ReturnType<typeof useProfileSearch>;
    tags: ReturnType<typeof useTagSearch>;
    isBusy: boolean;
    query: string;
    onOpenTag: (tag: string) => void;
    onOpenProfile: (username: string) => void;
}

function Results({
    accounts,
    tags,
    isBusy,
    query,
    onOpenTag,
    onOpenProfile,
}: ResultsProps) {
    const { t } = useI18n();

    const isEmpty =
        !isBusy && accounts.results.length === 0 && tags.results.length === 0;

    /*
     * One search failing is not the screen failing. Both halves are asked the
     * same question of two endpoints, and reporting an error over results that
     * did arrive would throw away the half that worked.
     */
    const error =
        accounts.results.length === 0 && tags.results.length === 0
            ? (accounts.error ?? tags.error)
            : null;

    if (error && !isBusy) {
        return <ErrorState message={error} />;
    }

    if (isEmpty) {
        return (
            <EmptyState
                title={t("explore.noResults", { query })}
                description={t("explore.searchHint")}
            />
        );
    }

    return (
        <ScrollView keyboardShouldPersistTaps="handled">
            {accounts.results.length > 0 && (
                <>
                    <SectionTitle label={t("explore.sectionAccounts")} />
                    {accounts.results.map((account) => (
                        <AccountResultRow
                            key={account.id}
                            account={account}
                            onPress={onOpenProfile}
                        />
                    ))}
                </>
            )}

            {tags.results.length > 0 && (
                <>
                    <SectionTitle label={t("explore.sectionTags")} />
                    {tags.results.map((tag) => (
                        <TagResultRow
                            key={tag.name}
                            tag={tag}
                            onPress={onOpenTag}
                        />
                    ))}
                </>
            )}

            {/* Under the results rather than instead of them: the two searches
                land separately, and blanking what has arrived to wait for the
                other one is a list that flickers on every keystroke. */}
            {isBusy && (
                <View className="py-6">
                    <Spinner />
                </View>
            )}
        </ScrollView>
    );
}

function SectionTitle({ label }: { label: string }) {
    return (
        <View className="bg-surface-1 px-4 py-2">
            <Text
                size="caption"
                tone="subtle"
                className="font-semibold uppercase"
            >
                {label}
            </Text>
        </View>
    );
}
