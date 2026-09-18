import { Pressable, TextInput, View } from "react-native";

import { ARTICLE_LIMITS } from "../../domain/draft";
import { CloseIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { addTag, normaliseTag } from "../../domain/tags";
import { useI18n } from "@shared/hooks/useI18n";

export interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    /**
     * What is typed and not yet a chip. Held by the screen, which commits it
     * when publishing — see `ArticleEditorScreen`.
     */
    typed: string;
    onTypedChange: (typed: string) => void;
}

/**
 * Tags as chips, typed one at a time.
 *
 * A tag is committed by the keyboard's return key, by a comma, or by leaving
 * the field. The web also removes the last chip on backspace in an empty
 * field; that is not ported, because Android's soft keyboards do not reliably
 * report a backspace that deletes nothing — each chip carries its own ✕
 * instead, which is also the bigger target.
 *
 * The hint under the field shows what a tag will *become* before it is added,
 * so `Clean Architecture` turning into `#clean-architecture` is not a surprise
 * discovered on the chip.
 */
export function TagInput({
    tags,
    onChange,
    typed,
    onTypedChange: setTyped,
}: TagInputProps) {
    const { t } = useI18n();

    const isFull = tags.length >= ARTICLE_LIMITS.tagsMax;

    function commit(raw: string) {
        setTyped("");
        const next = addTag(tags, raw, ARTICLE_LIMITS.tagsMax);
        if (next !== tags) onChange(next);
    }

    function handleChange(value: string) {
        // A comma ends the tag being typed; anything after it starts the next.
        const comma = value.indexOf(",");
        if (comma === -1) {
            setTyped(value);
            return;
        }
        commit(value.slice(0, comma));
        setTyped(value.slice(comma + 1));
    }

    const preview = normaliseTag(typed);
    const willChange = typed.trim() !== "" && preview !== typed.trim();

    return (
        <View className="gap-2">
            {tags.length > 0 && (
                <View className="flex-row flex-wrap gap-2">
                    {tags.map((tag) => (
                        <View
                            key={tag}
                            className="flex-row items-center gap-1 rounded-full bg-ink/10 py-1 pl-3 pr-1"
                        >
                            <Text size="caption" tone="muted">
                                #{tag}
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("editor.removeTag", {
                                    tag,
                                })}
                                onPress={() =>
                                    onChange(tags.filter((it) => it !== tag))
                                }
                                hitSlop={8}
                                className="h-5 w-5 items-center justify-center rounded-full active:bg-ink/10"
                            >
                                <CloseIcon size={12} className="text-ink/50" />
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}

            {!isFull && (
                <TextInput
                    value={typed}
                    onChangeText={handleChange}
                    onSubmitEditing={() => commit(typed)}
                    onBlur={() => commit(typed)}
                    // Return commits the tag and keeps the keyboard up for
                    // the next one, rather than closing it after each.
                    submitBehavior="submit"
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t("editor.tagPlaceholder")}
                    accessibilityLabel={t("editor.tags")}
                    className="py-1 text-sm text-ink placeholder:text-ink/35"
                />
            )}

            <Text size="caption" tone="subtle">
                {isFull
                    ? t("editor.tagsFull", { max: ARTICLE_LIMITS.tagsMax })
                    : willChange
                      ? t("editor.tagWillBecome", { tag: preview })
                      : t("editor.tagHint")}
            </Text>
        </View>
    );
}
