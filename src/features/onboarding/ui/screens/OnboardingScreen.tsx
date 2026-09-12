import { BackHandler, FlatList, View } from "react-native";
import { useCallback, useEffect, useState } from "react";

import { AccountCard } from "../components/AccountCard";
import type { BotProfile } from "../../data/bot.types";
import { Button } from "@shared/ui/Button";
import type { CategoryValue } from "@shared/constants/categories";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { InterestPicker } from "../components/InterestPicker";
import {
    MIN_FOLLOWS,
    followRequirement,
} from "../../domain/follow-requirement";
import { Screen } from "@shared/ui/Screen";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { useOnboardingFollows } from "../hooks/useOnboardingFollows";
import { useOnboardingStore } from "../store/onboarding.store";
import { useOnboardingSuggestions } from "../hooks/useOnboardingSuggestions";

export interface OnboardingScreenProps {
    /**
     * How many accounts the reader already follows, read by the route.
     *
     * A prop rather than a hook of this feature's own: the number comes from
     * `GET /profiles/:username`, which belongs to the profile feature, and a
     * feature may not reach into another. The route composes the two.
     */
    alreadyFollowing: number;
    /** Called once the requirement is met and the flow is done. */
    onFinish: (interests: CategoryValue[]) => void;
}

/**
 * The two-step flow a new account passes through before it reaches the app.
 *
 * One screen with a `step` rather than two routes, as on the web. The steps
 * are one question asked in two halves — going back has to return to the
 * fields as they were left, and neither half is worth a URL of its own.
 *
 * The bottom inset **is** honoured here, unlike the screens inside the tabs:
 * there is no tab bar under this one to fill the gesture strip.
 */
export function OnboardingScreen({
    alreadyFollowing,
    onFinish,
}: OnboardingScreenProps) {
    const { t } = useI18n();

    const storedInterests = useOnboardingStore((s) => s.interests);
    const setInterests = useOnboardingStore((s) => s.setInterests);

    const [step, setStep] = useState<"fields" | "accounts">("fields");
    // Seeded from the store, so coming back to step one shows the fields
    // already picked. The API has nowhere to keep them.
    const [selected, setSelected] = useState<CategoryValue[]>(storedInterests);

    const toggleField = useCallback(
        (category: CategoryValue) => {
            setSelected((previous) => {
                const next = previous.includes(category)
                    ? previous.filter((value) => value !== category)
                    : [...previous, category];

                // Written as the picker is used rather than at the end: the
                // only record these fields have is the store.
                setInterests(next);
                return next;
            });
        },
        [setInterests],
    );

    /*
     * Android's back gesture, on step two only.
     *
     * The flow is reached with `replace`, so there is nothing behind it and
     * the default is to leave the app — from a screen with a "back" button
     * drawn on it, which is the kind of mismatch that reads as a bug. Step one
     * keeps the default: there is genuinely nowhere behind it, and the gate
     * would turn the account around at the door anyway.
     */
    useEffect(() => {
        if (step !== "accounts") return;

        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                setStep("fields");
                return true;
            },
        );

        return () => subscription.remove();
    }, [step]);

    return (
        <Screen>
            <View className="flex-1 px-4 pt-6">
                <Text size="caption" tone="subtle" className="uppercase">
                    {t("onboarding.stepOfTwo", {
                        n: step === "fields" ? 1 : 2,
                    })}
                </Text>

                {step === "fields" ? (
                    <FieldsStep
                        selected={selected}
                        onToggle={toggleField}
                        onContinue={() => setStep("accounts")}
                    />
                ) : (
                    <AccountsStep
                        categories={selected}
                        alreadyFollowing={alreadyFollowing}
                        onBack={() => setStep("fields")}
                        onFinish={() => onFinish(selected)}
                    />
                )}
            </View>
        </Screen>
    );
}

interface FieldsStepProps {
    selected: CategoryValue[];
    onToggle: (category: CategoryValue) => void;
    onContinue: () => void;
}

function FieldsStep({ selected, onToggle, onContinue }: FieldsStepProps) {
    const { t } = useI18n();

    return (
        <>
            <Text size="display" className="pt-2">
                {t("onboarding.fieldsTitle")}
            </Text>
            <Text tone="muted" className="pt-2">
                {t("onboarding.fieldsBody")}
            </Text>

            <View className="pt-8">
                <InterestPicker selected={selected} onToggle={onToggle} />
            </View>

            {/* Pushed to the bottom of whatever height is left, so the button
                sits where a thumb is rather than under the last tile. */}
            <View className="mt-auto py-6">
                <Button
                    label={t("onboarding.continue")}
                    size="full"
                    disabled={selected.length === 0}
                    onPress={onContinue}
                />
            </View>
        </>
    );
}

interface AccountsStepProps {
    categories: CategoryValue[];
    alreadyFollowing: number;
    onBack: () => void;
    onFinish: () => void;
}

function AccountsStep({
    categories,
    alreadyFollowing,
    onBack,
    onFinish,
}: AccountsStepProps) {
    const { t } = useI18n();

    const {
        accounts,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        retry,
    } = useOnboardingSuggestions(categories);

    const { followedIds, serverFollowedIds, pendingIds, netChange, toggle } =
        useOnboardingFollows(accounts);

    /*
     * Suggestions that arrived already followed are part of
     * `alreadyFollowing`, so they cannot also be part of the answer — only the
     * rest are follows this step can still ask for.
     */
    const followable = accounts.filter(
        (account) => !serverFollowedIds.has(account.userId),
    ).length;

    const { stillNeeded, required, progress, canFinish } = followRequirement({
        alreadyFollowing,
        followable,
        // A list that errored or came back short is done growing. One still in
        // flight is not, and the requirement must not soften while it is.
        listIsFinal: !isLoading && (!!error || !hasMore),
        netChange,
    });

    /** Stable, so the memo on the rows is worth having. */
    const handleToggle = useCallback(
        (userId: string) => void toggle(userId),
        [toggle],
    );

    const renderItem = useCallback(
        ({ item }: { item: BotProfile }) => (
            <AccountCard
                account={item}
                isFollowing={followedIds.has(item.userId)}
                isPending={pendingIds.has(item.userId)}
                onToggle={handleToggle}
            />
        ),
        [followedIds, handleToggle, pendingIds],
    );

    return (
        <>
            <Text size="display" className="pt-2">
                {/* "at least 1 accounts" reads badly, and this heading is the
                    one place the number is spelled out in a sentence. */}
                {stillNeeded === 1
                    ? t("onboarding.accountsTitleOne")
                    : t("onboarding.accountsTitle", {
                          n: stillNeeded || MIN_FOLLOWS,
                      })}
            </Text>
            <Text tone="muted" className="pt-2">
                {t("onboarding.accountsBody")}
            </Text>

            {/* Full width, against the screen's own padding: rows carry their
                own, and a divider that stops short of the edge reads as a gap
                in the list. */}
            <View className="-mx-4 flex-1 pt-4">
                {isLoading ? (
                    <Spinner center />
                ) : error ? (
                    <ErrorState
                        message={error}
                        onRetry={retry}
                        retryLabel={t("onboarding.tryAgain")}
                    />
                ) : (
                    <FlatList
                        data={accounts}
                        keyExtractor={(account) => account.userId}
                        renderItem={renderItem}
                        windowSize={7}
                        ListEmptyComponent={
                            <EmptyState
                                title={t("onboarding.emptyTitle")}
                                description={t("onboarding.emptyBody")}
                            />
                        }
                        /*
                         * A button rather than infinite scroll, and the web's
                         * reason is stronger on a phone: one page of fifty
                         * covers the requirement several times over, and a
                         * list that grows as you reach the bottom of it keeps
                         * moving the finish bar you are scrolling towards.
                         */
                        ListFooterComponent={
                            hasMore ? (
                                <View className="items-center py-6">
                                    <Button
                                        label={
                                            isLoadingMore
                                                ? t("onboarding.loadingMore")
                                                : t("onboarding.loadMore")
                                        }
                                        variant="outline"
                                        size="sm"
                                        loading={isLoadingMore}
                                        onPress={loadMore}
                                    />
                                </View>
                            ) : null
                        }
                    />
                )}
            </View>

            {/* Docked rather than scrolling with the list: it carries the only
                way out of this screen, and the progress it reports is what
                somebody watches while they tap. */}
            <View className="-mx-4 flex-row items-center gap-3 border-t border-ink/10 px-4 py-4">
                <Button
                    label={t("onboarding.back")}
                    variant="ghost"
                    size="sm"
                    onPress={onBack}
                />
                <Text size="small" tone="subtle" className="flex-1">
                    {t("onboarding.progress", { n: progress, total: required })}
                </Text>
                <Button
                    label={t("onboarding.finish")}
                    size="sm"
                    disabled={!canFinish}
                    onPress={onFinish}
                />
            </View>
        </>
    );
}
