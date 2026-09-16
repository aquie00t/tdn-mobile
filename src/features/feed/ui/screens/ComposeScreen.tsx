import {
    KeyboardAvoidingView,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import { Button } from "@shared/ui/Button";
import { MediaPicker } from "@shared/ui/MediaPicker";
import { MentionSuggestions } from "@shared/ui/MentionSuggestions";
import { QuotedPostCard } from "../components/QuotedPostCard";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Text } from "@shared/ui/Text";
import { POST_MAX_LENGTH, usePostComposer } from "../hooks/usePostComposer";
import { useI18n } from "@shared/hooks/useI18n";
import { useMentionAutocomplete } from "@shared/hooks/useMentionAutocomplete";
import { usePost } from "../hooks/usePost";
import { usePostInboxStore } from "../store/post-inbox.store";
import { useQuoteDraftStore } from "../store/quote-draft.store";
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
    /**
     * `quoteId` turns this screen into the quote composer, and that is the
     * whole of the difference: the preview appears, the picker goes, and an
     * empty body becomes valid because the API reads a `quotedPostId` with no
     * content as a plain repost.
     *
     * The web opens a modal for this. A second composer would mean a second
     * copy of the idempotency key, the counter, the keyboard handling and the
     * submit button — and the `Modal` primitive is still unwritten, which PR 3
     * asked for it to stay until something genuinely needed one.
     */
    const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();
    const draft = useQuoteDraftStore((s) => s.quoted);
    const clearDraft = useQuoteDraftStore((s) => s.clear);
    const { post: fetched, fetchPost } = usePost(quoteId ?? "");

    // What the card handed over, or what a cold entry has to read for itself.
    const quoted = draft?.id === quoteId ? draft : fetched;

    useEffect(() => {
        // Only when nothing was handed over — a link opened from outside the
        // app. `usePost` does not fetch on its own, which is what makes it
        // safe to hold unconditionally.
        if (quoteId && !draft) void fetchPost();
    }, [quoteId, draft, fetchPost]);

    useEffect(() => () => clearDraft(), [clearDraft]);

    const composer = usePostComposer({
        quotedPostId: quoteId,
        onPosted: (post) => {
            addToInbox(post);
            router.back();
        },
    });

    const mention = useMentionAutocomplete(composer.content);

    const label = composer.media.isUploading
        ? t("postBox.uploading")
        : composer.isSubmitting
          ? composer.isQuote
              ? t("quote.posting")
              : t("postBox.posting")
          : composer.isQuote
            ? t("quote.submit")
            : t("postBox.post");

    return (
        <Screen edges={{ top: true, bottom: true }}>
            <ScreenHeader
                title={composer.isQuote ? t("quote.title") : t("postBox.post")}
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

            <KeyboardAvoidingView className="flex-1" behavior="padding">
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
                            onSelectionChange={mention.onSelectionChange}
                            // Controlled for the one render that follows an
                            // insertion and `undefined` otherwise, or the
                            // field fights the person typing into it.
                            selection={mention.selection}
                            placeholder={
                                composer.isQuote
                                    ? t("quote.placeholder")
                                    : t("postBox.placeholder")
                            }
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

                    {/*
                     * Under the field rather than at the caret, which cannot
                     * be measured here — see `useMentionAutocomplete`. This
                     * screen has the room above the keyboard that the docked
                     * comment box does not, so the list goes where the eye
                     * already is rather than over the text being written.
                     */}
                    {mention.isOpen && (
                        <MentionSuggestions
                            isSearching={mention.isSearching}
                            suggestions={mention.suggestions}
                            onSelect={(item) => {
                                const next = mention.select(item);
                                if (next !== null) composer.setContent(next);
                            }}
                        />
                    )}

                    {/*
                     * Rendered from the full post the screen fetched: a `Post`
                     * carries everything `QuotedPost` needs, including the
                     * flags the embedded card must read from the quoted post
                     * rather than from the quote.
                     */}
                    {composer.isQuote && quoted && (
                        <QuotedPostCard post={quoted} isPreview />
                    )}

                    {!composer.isQuote && (
                        <MediaPicker
                            assets={composer.media.assets}
                            onPickFromLibrary={() =>
                                void composer.media.pickFromLibrary()
                            }
                            onTakePhoto={() => void composer.media.takePhoto()}
                            onRemove={composer.media.removeAsset}
                            remainingSlots={composer.media.remainingSlots}
                            max={composer.media.max}
                            disabled={composer.isSubmitting}
                        />
                    )}

                    {/*
                     * Shown rather than enforced by truncation: the post
                     * button is already refusing, and a sentence is the only
                     * thing that says why.
                     */}
                    {composer.mentionLimit.isOverLimit && (
                        <Text size="small" tone="danger">
                            {t("error.mentionLimit", {
                                max: composer.mentionLimit.max,
                            })}
                        </Text>
                    )}

                    {composer.content.trim().length > COUNTER_THRESHOLD && (
                        <Text
                            size="caption"
                            tone={composer.isTooLong ? "danger" : "subtle"}
                            className="text-right"
                        >
                            {composer.content.trim().length} / {POST_MAX_LENGTH}
                        </Text>
                    )}

                    {/*
                     * Only an answer the writer has to act on — a refused file,
                     * a rate limit. A failure of ours leaves this empty and
                     * the text where it was.
                     */}
                    {composer.error && (
                        <Text size="small" tone="danger">
                            {composer.error}
                        </Text>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}
