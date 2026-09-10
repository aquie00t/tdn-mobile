import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import { Button } from "@shared/ui/Button";
import { MediaPicker } from "../components/MediaPicker";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Text } from "@shared/ui/Text";
import {
    MAX_FILES,
    POST_MAX_LENGTH,
    usePostComposer,
} from "../hooks/usePostComposer";
import { useI18n } from "@shared/hooks/useI18n";
import { usePostInboxStore } from "../store/post-inbox.store";
import { useSessionStore } from "@core/session/session.store";

/** The counter appears only once the cap is close enough to matter. */
const COUNTER_THRESHOLD = POST_MAX_LENGTH - 60;

/**
 * Writing a post, on a screen of its own.
 *
 * The web keeps its composer at the top of the feed. On a phone that costs
 * about 120px before the first post on a 360px screen, and anybody who has
 * scrolled has to climb back to the top to use it. A screen instead: reached
 * from the feed's write button, dismissed by the header's back arrow, and with
 * room for the previews and the counter that the inline box has nowhere to put.
 *
 * **Post is in the header**, not under the field. It is the one control that
 * must never be behind the keyboard, and the header is the one place on a
 * phone the keyboard cannot reach.
 */
export function ComposeScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const avatarUrl = useSessionStore((s) => s.user?.avatarUrl);

    const addToInbox = usePostInboxStore((s) => s.add);

    /*
     * The feed is a different screen with its own state, so the new post is
     * left where it can find it rather than handed over. The web's inline box
     * can simply call `addPost`; a composer that dismisses itself cannot.
     */
    const composer = usePostComposer((post) => {
        addToInbox(post);
        router.back();
    });

    const label = composer.isUploading
        ? t("postBox.uploading")
        : composer.isSubmitting
          ? t("postBox.posting")
          : t("postBox.post");

    return (
        <Screen edges={{ top: true, bottom: true }}>
            <ScreenHeader
                title={t("postBox.post")}
                right={
                    <Button
                        label={label}
                        size="sm"
                        loading={composer.isSubmitting}
                        disabled={!composer.canSubmit}
                        onPress={() => void composer.submit()}
                        className="mr-1"
                    />
                }
            />

            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    contentContainerClassName="gap-4 px-4 py-4"
                >
                    <View className="flex-row gap-3">
                        {avatarUrl ? (
                            <Avatar uri={avatarUrl} size={40} />
                        ) : (
                            <View className="h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-ink/5">
                                <ProfileIcon
                                    size={20}
                                    className="text-ink/40"
                                />
                            </View>
                        )}

                        <TextInput
                            value={composer.content}
                            onChangeText={composer.setContent}
                            placeholder={t("postBox.placeholder")}
                            multiline
                            autoFocus
                            // No `maxLength`. A hard stop swallows a paste
                            // with no explanation; the counter says what is
                            // wrong and the control refuses, which is
                            // something somebody can act on.
                            className="min-h-[120px] flex-1 text-base text-ink placeholder:text-ink/35 selection:text-accent"
                            textAlignVertical="top"
                        />
                    </View>

                    <MediaPicker
                        assets={composer.assets}
                        onPickFromLibrary={() =>
                            void composer.pickFromLibrary()
                        }
                        onTakePhoto={() => void composer.takePhoto()}
                        onRemove={composer.removeAsset}
                        remainingSlots={composer.remainingSlots}
                        max={MAX_FILES}
                        disabled={composer.isSubmitting}
                    />

                    {composer.content.trim().length > COUNTER_THRESHOLD && (
                        <Text
                            size="caption"
                            tone={composer.isTooLong ? "danger" : "subtle"}
                            className="text-right"
                        >
                            {composer.content.trim().length} / {POST_MAX_LENGTH}
                        </Text>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}
