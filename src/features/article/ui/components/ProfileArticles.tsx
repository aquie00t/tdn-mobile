import { Pressable, ScrollView } from "react-native";
import { useState } from "react";
import type { ReactElement } from "react";

import { ArticleList } from "./ArticleList";
import type { ArticleStatus } from "../../data/article.types";
import type { TranslationKey } from "@shared/i18n/translations";
import { Text } from "@shared/ui/Text";
import { cn } from "@shared/ui/cn";
import { useI18n } from "@shared/hooks/useI18n";

const STATUSES: { value: ArticleStatus; labelKey: TranslationKey }[] = [
    { value: "PUBLISHED", labelKey: "editor.statusPublished" },
    { value: "DRAFT", labelKey: "editor.statusDraft" },
    { value: "ARCHIVED", labelKey: "editor.statusArchived" },
];

export interface ProfileArticlesProps {
    username: string;
    /** Your own profile, which reads a different endpoint. */
    isMe: boolean;
    /** The profile's header and tabs, scrolled with the rows. */
    header: ReactElement;
}

/**
 * A profile's Articles tab.
 *
 * **Two endpoints, not one list with a filter.** Somebody else's profile reads
 * the public list narrowed to them, which returns published articles only — so
 * a visitor never sees a draft, and there is nothing for them to filter. Your
 * own reads `/articles/me`, the only endpoint that returns a draft at all, one
 * status at a time behind the chips the web draws in the same place.
 *
 * This is where a draft is found again once its editor is closed; before it,
 * there was no way back to one on this client.
 */
export function ProfileArticles({
    username,
    isMe,
    header,
}: ProfileArticlesProps) {
    const { t } = useI18n();
    const [status, setStatus] = useState<ArticleStatus>("PUBLISHED");

    return (
        <ArticleList
            query={
                isMe ? { scope: "mine", status } : { scope: "author", username }
            }
            showWrite={isMe}
            emptyTitle={t("articleList.empty")}
            header={
                <>
                    {header}
                    {isMe && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerClassName="gap-2 px-4 py-3"
                        >
                            {STATUSES.map(({ value, labelKey }) => {
                                const isOn = status === value;

                                return (
                                    <Pressable
                                        key={value}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isOn }}
                                        onPress={() => setStatus(value)}
                                        className={cn(
                                            "rounded-full px-3 py-1.5",
                                            isOn
                                                ? "bg-ink active:bg-ink-hover"
                                                : "bg-ink/10 active:bg-ink/15",
                                        )}
                                    >
                                        <Text
                                            size="caption"
                                            className={cn(
                                                "font-medium",
                                                isOn
                                                    ? "text-ground"
                                                    : "text-ink/70",
                                            )}
                                        >
                                            {t(labelKey)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}
                </>
            }
        />
    );
}
