import { Pressable, TextInput, View } from "react-native";

import { CloseIcon, SearchIcon } from "@shared/ui/icons/lucide";
import { Spinner } from "@shared/ui/Spinner";
import { useI18n } from "@shared/hooks/useI18n";

export interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    /** Swaps the glyph for a spinner while a search is out. */
    isSearching: boolean;
}

/**
 * The one search box in the app.
 *
 * Not `TextField`: that primitive is a form control — a rounded rectangle with
 * a validation slot under it — and this is a pill with two affordances inside
 * it. The two would fight over padding, and the field below has no error to
 * show, so it would carry an empty `View` on every render.
 *
 * The clear button matters more here than on the web. Dismissing a search on a
 * phone means clearing the box, and the alternative is holding backspace.
 */
export function SearchField({
    value,
    onChange,
    isSearching,
}: SearchFieldProps) {
    const { t } = useI18n();

    return (
        <View className="flex-row items-center gap-2 rounded-full border border-ink/10 bg-ink/5 px-4 py-2.5">
            {isSearching ? (
                <Spinner />
            ) : (
                <SearchIcon size={16} className="text-ink/30" />
            )}

            <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={t("explore.searchPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                className="flex-1 p-0 text-base text-ink placeholder:text-ink/35 selection:text-accent"
            />

            {value.length > 0 && (
                <Pressable
                    accessibilityRole="button"
                    onPress={() => onChange("")}
                    hitSlop={8}
                >
                    <CloseIcon size={16} className="text-ink/40" />
                </Pressable>
            )}
        </View>
    );
}
