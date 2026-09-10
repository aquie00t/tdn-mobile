import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { AddMediaIcon, CameraIcon, CloseIcon } from "./icons/lucide";
import type { PickedAsset } from "../utils/asset-to-form";
import { Text } from "./Text";
import { useI18n } from "../hooks/useI18n";

export interface MediaPickerProps {
    assets: PickedAsset[];
    onPickFromLibrary: () => void;
    onTakePhoto: () => void;
    onRemove: (uri: string) => void;
    /** How many more may be added. Zero disables both controls. */
    remainingSlots: number;
    max: number;
    disabled?: boolean;
    /**
     * Off where the caller draws its own way to add a file — a chat composer
     * puts that inside the input row rather than under it, because a control
     * row that is always there is a control row you always pay for.
     */
    showControls?: boolean;
}

const FILL = { width: "100%", height: "100%" } as const;

/**
 * What has been picked, and the two ways to pick more.
 *
 * The previews are the assets' own URIs — nothing is created and so nothing
 * has to be released. The web builds `blob:` URLs with `createObjectURL` and
 * has to revoke every one of them on submit, on removal and on unmount, or an
 * attachment leaks for the life of the page. That whole class of bookkeeping
 * does not exist here.
 *
 * The camera is the control the web has no equivalent for. A browser can only
 * be handed a file that already exists; a phone is usually pointed at the
 * thing being posted about.
 */
export function MediaPicker({
    assets,
    onPickFromLibrary,
    onTakePhoto,
    onRemove,
    remainingSlots,
    max,
    disabled = false,
    showControls = true,
}: MediaPickerProps) {
    const { t } = useI18n();
    const isFull = remainingSlots <= 0;

    return (
        <View className="gap-3">
            {assets.length > 0 && (
                <View className="flex-row flex-wrap">
                    {assets.map((asset) => (
                        <View
                            key={asset.uri}
                            className="aspect-square w-1/3 p-1"
                        >
                            <View className="flex-1 overflow-hidden rounded-xl bg-surface-2">
                                <Image
                                    source={{ uri: asset.uri }}
                                    style={FILL}
                                    contentFit="cover"
                                />

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t("common.dismiss")}
                                    onPress={() => onRemove(asset.uri)}
                                    hitSlop={8}
                                    // Over a photograph rather than over the
                                    // theme, so `scrim` and `on-fill` are the
                                    // right roles: neither swaps, because what
                                    // they contrast against is somebody's
                                    // picture and not the page.
                                    className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-scrim/60"
                                >
                                    <CloseIcon
                                        size={14}
                                        className="text-on-fill"
                                    />
                                </Pressable>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {showControls && (
                <View className="flex-row items-center gap-1">
                    <Control
                        icon={AddMediaIcon}
                        label={t("postBox.media")}
                        disabled={disabled || isFull}
                        onPress={onPickFromLibrary}
                    />
                    <Control
                        icon={CameraIcon}
                        label={t("postBox.media")}
                        disabled={disabled || isFull}
                        onPress={onTakePhoto}
                    />

                    {assets.length > 0 && (
                        <Text size="caption" tone="subtle" className="ml-1">
                            {assets.length}/{max}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

function Control({
    icon: Icon,
    label,
    disabled,
    onPress,
}: {
    icon: typeof AddMediaIcon;
    label: string;
    disabled: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            hitSlop={8}
            className={
                disabled
                    ? "h-10 w-10 items-center justify-center rounded-full opacity-30"
                    : "h-10 w-10 items-center justify-center rounded-full active:bg-ink/10"
            }
        >
            <Icon size={20} className="text-ink/60" />
        </Pressable>
    );
}
