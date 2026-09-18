import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Pressable, TextInput, View } from "react-native";
import { useState } from "react";

import { ARTICLE_LIMITS } from "../../domain/draft";
import { AddMediaIcon, CloseIcon } from "@shared/ui/icons/lucide";
import { assetToFormPart } from "@shared/utils/asset-to-form";
import type { PickedAsset } from "@shared/utils/asset-to-form";
import { getSafeMediaUri } from "@shared/utils/media-uri";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

/** What the cover endpoint accepts. SVG is refused whatever it is named. */
const ACCEPTED = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
]);

const FILL = { width: "100%", height: "100%" } as const;

export interface CoverPickerProps {
    /** A cover the article already has, if any. */
    existingUrl: string | null;
    /** Chosen but not yet uploaded — that happens at the next save. */
    asset: PickedAsset | null;
    alt: string;
    onPick: (asset: PickedAsset | null) => void;
    onAltChange: (alt: string) => void;
    /** Takes off a cover the article already had; the next save erases it. */
    onRemoveExisting: () => void;
    disabled?: boolean;
}

/**
 * The cover: one picture, optional, chosen from the library.
 *
 * The file is checked the moment it is picked rather than when the upload
 * refuses it, because by then the writer is pressing publish and the upload is
 * the last thing between them and posting. The refusal is said here, under the
 * slot, since there are no toasts to say it anywhere else.
 *
 * The preview is the reading screen's own 16:9 box, so the writer sees the
 * crop a reader will get rather than a taller picture they have to guess from.
 */
export function CoverPicker({
    existingUrl,
    asset,
    alt,
    onPick,
    onAltChange,
    onRemoveExisting,
    disabled = false,
}: CoverPickerProps) {
    const { t } = useI18n();
    const [pickError, setPickError] = useState<string | null>(null);

    async function handlePick() {
        // Asked for here rather than at boot: at the moment somebody presses
        // "add a cover", the question answers itself.
        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
        });
        if (result.canceled) return;

        const picked = result.assets[0];
        if (!picked) return;

        if ((picked.fileSize ?? 0) > ARTICLE_LIMITS.coverBytesMax) {
            setPickError(t("editor.coverTooLarge"));
            return;
        }
        if (!ACCEPTED.has(assetToFormPart(picked, 0).type)) {
            setPickError(t("editor.coverWrongType"));
            return;
        }

        setPickError(null);
        onPick(picked);
    }

    const preview = asset?.uri ?? getSafeMediaUri(existingUrl);

    return (
        <View className="gap-2">
            {preview ? (
                <View className="aspect-[16/9] overflow-hidden rounded-xl border border-ink/10 bg-surface-2">
                    <Image
                        source={{ uri: preview }}
                        style={FILL}
                        contentFit="cover"
                        transition={150}
                    />
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("editor.removeCover")}
                        disabled={disabled}
                        onPress={() => {
                            if (asset) onPick(null);
                            else onRemoveExisting();
                        }}
                        hitSlop={8}
                        // Over a photograph rather than over the theme, so
                        // `scrim` and `on-fill`, which do not swap.
                        className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-scrim/60"
                    >
                        <CloseIcon size={16} className="text-on-fill" />
                    </Pressable>
                </View>
            ) : (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("editor.addCover")}
                    disabled={disabled}
                    onPress={() => void handlePick()}
                    className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-ink/20 py-8 active:bg-ink/5"
                >
                    <AddMediaIcon size={18} className="text-ink/50" />
                    <Text size="small" tone="muted">
                        {t("editor.addCover")}
                    </Text>
                </Pressable>
            )}

            {preview ? (
                <TextInput
                    value={alt}
                    onChangeText={(value) =>
                        onAltChange(value.slice(0, ARTICLE_LIMITS.coverAltMax))
                    }
                    placeholder={t("editor.coverAltPlaceholder")}
                    accessibilityLabel={t("editor.coverAlt")}
                    className="py-1 text-sm text-ink placeholder:text-ink/35"
                />
            ) : (
                // Most articles do without one, so this says so rather than
                // leaving the empty slot looking unfinished.
                <Text size="caption" tone="subtle">
                    {t("editor.coverOptional")}
                </Text>
            )}

            {pickError && (
                <Text size="small" tone="danger">
                    {pickError}
                </Text>
            )}
        </View>
    );
}
