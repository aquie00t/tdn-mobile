import {
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigation, useRouter } from "expo-router";

import { ARTICLE_LIMITS } from "../../domain/draft";
import { addTag } from "../../domain/tags";
import type { Article, ArticleStatus } from "../../data/article.types";
import { Button } from "@shared/ui/Button";
import { CategoryPicker } from "../components/CategoryPicker";
import { CoverPicker } from "../components/CoverPicker";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { MarkdownBody } from "../components/MarkdownBody";
import { MentionSuggestions } from "@shared/ui/MentionSuggestions";
import { Modal } from "@shared/ui/Modal";
import { SaveIndicator } from "../components/SaveIndicator";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { TagInput } from "../components/TagInput";
import { Text } from "@shared/ui/Text";
import type { TranslationKey } from "@shared/i18n/translations";
import { useArticle } from "../hooks/useArticle";
import { useArticleEditor } from "../hooks/useArticleEditor";
import { useI18n } from "@shared/hooks/useI18n";
import { useMentionAutocomplete } from "@shared/hooks/useMentionAutocomplete";

export interface ArticleEditorScreenProps {
    /** The article to edit; absent for a new one. */
    slug?: string;
}

const STATUS_KEYS: Record<ArticleStatus, TranslationKey> = {
    DRAFT: "editor.statusDraft",
    PUBLISHED: "editor.statusPublished",
    ARCHIVED: "editor.statusArchived",
};

/**
 * Writing an article, or changing one.
 *
 * A new article has nothing to load, so it never mounts the loader — asking
 * the API for an empty slug would spend a request on every visit and answer
 * with nothing useful.
 */
export function ArticleEditorScreen({ slug }: ArticleEditorScreenProps) {
    if (!slug) return <Editor initial={null} />;
    return <EditExisting slug={slug} />;
}

function EditExisting({ slug }: { slug: string }) {
    const { t } = useI18n();
    const { article, isLoading, error, notFound, retry } = useArticle(slug);

    if (isLoading || notFound || error || !article || !article.author.isMe) {
        return (
            <Screen edges={{ top: true, bottom: false }}>
                <ScreenHeader title={t("editor.editTitle")} />
                {isLoading ? (
                    <Spinner center />
                ) : error ? (
                    <ErrorState
                        message={error}
                        onRetry={() => void retry()}
                        retryLabel={t("postList.tryAgain")}
                    />
                ) : (
                    /*
                     * Somebody else's article is "not found" here too. The
                     * server would refuse every save, and an editor that fails
                     * at its first pause is worse than one that never opens.
                     */
                    <EmptyState
                        title={t("article.notFound")}
                        description={t("article.notFoundHint")}
                    />
                )}
            </Screen>
        );
    }

    /*
     * Keyed so a different article remounts the editor. `useArticleEditor`
     * seeds from `initial` in `useState` initialisers, which run once per
     * mount — without the key the editor would keep the first article's text
     * and the next autosave would write it over the second.
     */
    return <Editor key={article.id} initial={article} />;
}

function Editor({ initial }: { initial: Article | null }) {
    const { t } = useI18n();
    const router = useRouter();
    const [tab, setTab] = useState<"write" | "preview">("write");
    const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
    const [isBodyFocused, setIsBodyFocused] = useState(false);
    /**
     * `isBusy` covers archiving and deleting too, and the header's button
     * should say "publishing" only when that is what is happening.
     */
    const [isPublishing, setIsPublishing] = useState(false);

    /**
     * A tag typed but not yet committed. Held here rather than inside
     * `TagInput` so publishing can commit it: the button is in the header,
     * outside the form, and on Android tapping it does not take focus from
     * the field — so the blur that would have committed the tag never comes,
     * and the article would go out without it.
     */
    const [pendingTag, setPendingTag] = useState("");
    /** The way out the writer asked for, held while they confirm it. */
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

    const editor = useArticleEditor(initial);
    const { draft, update, status, leave } = editor;
    const mention = useMentionAutocomplete(draft.body);

    /*
     * Publishing and deleting navigate when they finish, and by then the
     * writer may have gone back on their own. Moving then would pop a second
     * screen — the reading screen behind — or replace the list.
     */
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    /*
     * Every way out passes through here: the header's arrow, the hardware
     * back button, the edge swipe. Outstanding work is sent as the pop starts,
     * rather than when the screen unmounts after its animation, so a reading
     * screen underneath hears about the save sooner. The one thing asked is
     * the one case that loses writing — a draft that cannot be saved yet.
     */
    const navigation = useNavigation();
    useEffect(
        () =>
            navigation.addListener("beforeRemove", (event) => {
                if (leave() === "go") return;
                event.preventDefault();
                setPendingLeave(
                    () => () => navigation.dispatch(event.data.action),
                );
            }),
        [navigation, leave],
    );

    const isPublished = status === "PUBLISHED";

    async function handlePublish() {
        if (pendingTag.trim() !== "") {
            update(
                "tags",
                addTag(draft.tags, pendingTag, ARTICLE_LIMITS.tagsMax),
            );
            setPendingTag("");
        }

        setIsPublishing(true);
        const published = await editor.publish();
        if (!isMounted.current) return;
        setIsPublishing(false);
        if (!published) return;

        /*
         * An article that was already open behind this screen re-reads itself
         * on the way back; a new one has no screen behind it to go back to,
         * so this one becomes its reading screen. Either way the reader lands
         * on what they published — which says "it is live" better than a
         * toast would.
         */
        if (initial) {
            router.back();
        } else {
            router.replace({
                pathname: "/articles/[slug]",
                params: { slug: published.slug },
            });
        }
    }

    async function handleArchive() {
        setConfirm(null);
        await editor.archive();
    }

    async function handleDelete() {
        setConfirm(null);
        // Past the reading screen too, which would otherwise be showing an
        // article that no longer exists.
        if ((await editor.remove()) && isMounted.current) router.dismissAll();
    }

    return (
        <Screen edges={{ top: true, bottom: true }}>
            <ScreenHeader
                title={initial ? t("editor.editTitle") : t("editor.newTitle")}
                titleContent={
                    <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        {status && (
                            <View className="rounded-full border border-ink/15 px-2 py-0.5">
                                <Text
                                    size="caption"
                                    tone="subtle"
                                    className="font-semibold uppercase"
                                >
                                    {t(STATUS_KEYS[status])}
                                </Text>
                            </View>
                        )}
                        <View className="min-w-0 flex-1">
                            <SaveIndicator
                                state={editor.saveState}
                                isDirty={editor.isDirty}
                                problem={editor.problem}
                                error={editor.saveError}
                                onRetry={() => void editor.save()}
                            />
                        </View>
                    </View>
                }
                right={
                    isPublished ? undefined : (
                        /*
                         * In the header for the reason the post composer's
                         * button is: it is the one control that must never be
                         * behind the keyboard.
                         */
                        <Button
                            label={
                                isPublishing
                                    ? t("editor.publishing")
                                    : t("editor.publish")
                            }
                            size="sm"
                            loading={isPublishing}
                            disabled={!editor.canSave || editor.isBusy}
                            onPress={() => void handlePublish()}
                            className="mr-1"
                        />
                    )
                }
            />

            <View className="flex-row border-b border-ink/10">
                {(["write", "preview"] as const).map((value) => (
                    <Pressable
                        key={value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === value }}
                        onPress={() => setTab(value)}
                        className="flex-1 items-center py-2.5"
                    >
                        <Text
                            size="small"
                            tone={tab === value ? "default" : "subtle"}
                            className="font-medium"
                        >
                            {t(
                                value === "write"
                                    ? "editor.write"
                                    : "editor.preview",
                            )}
                        </Text>
                        {tab === value && (
                            <View className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full bg-ink" />
                        )}
                    </Pressable>
                ))}
            </View>

            <KeyboardAvoidingView className="flex-1" behavior="padding">
                {tab === "write" ? (
                    <ScrollView
                        className="flex-1"
                        keyboardShouldPersistTaps="handled"
                        contentContainerClassName="gap-6 px-4 py-5"
                    >
                        <TextInput
                            value={draft.title}
                            onChangeText={(value) =>
                                update(
                                    "title",
                                    value.slice(0, ARTICLE_LIMITS.titleMax),
                                )
                            }
                            placeholder={t("editor.titlePlaceholder")}
                            accessibilityLabel={t("editor.titlePlaceholder")}
                            // Multiline so a long title wraps where it will be
                            // read, but return still moves on rather than
                            // writing a newline no title can hold.
                            multiline
                            submitBehavior="blurAndSubmit"
                            className="text-2xl font-semibold text-ink placeholder:text-ink/25"
                        />

                        <CoverPicker
                            existingUrl={editor.existingCoverUrl}
                            asset={editor.coverAsset}
                            alt={draft.coverAlt}
                            onPick={editor.setCoverAsset}
                            onAltChange={(value) => update("coverAlt", value)}
                            onRemoveExisting={editor.removeExistingCover}
                            disabled={editor.isBusy}
                        />

                        <TextInput
                            value={draft.body}
                            onChangeText={(value) => update("body", value)}
                            onSelectionChange={mention.onSelectionChange}
                            // Controlled for the one render that follows an
                            // insertion and `undefined` otherwise, or the
                            // field fights the person typing into it.
                            selection={mention.selection}
                            onFocus={() => setIsBodyFocused(true)}
                            onBlur={() => setIsBodyFocused(false)}
                            placeholder={t("editor.bodyPlaceholder")}
                            accessibilityLabel={t("editor.bodyPlaceholder")}
                            multiline
                            textAlignVertical="top"
                            className="min-h-[320px] text-base leading-7 text-ink placeholder:text-ink/25 selection:text-accent"
                        />

                        <Field label={t("editor.excerpt")}>
                            <TextInput
                                value={draft.excerpt}
                                onChangeText={(value) =>
                                    update(
                                        "excerpt",
                                        value.slice(
                                            0,
                                            ARTICLE_LIMITS.excerptMax,
                                        ),
                                    )
                                }
                                placeholder={t("editor.excerptPlaceholder")}
                                accessibilityLabel={t("editor.excerpt")}
                                multiline
                                className="text-sm text-ink placeholder:text-ink/35"
                            />
                            <Text size="caption" tone="subtle">
                                {t("editor.excerptHint")}
                            </Text>
                        </Field>

                        <Field label={t("editor.tags")}>
                            <TagInput
                                tags={draft.tags}
                                onChange={(tags) => update("tags", tags)}
                                typed={pendingTag}
                                onTypedChange={setPendingTag}
                            />
                        </Field>

                        <Field label={t("editor.categories")}>
                            <CategoryPicker
                                selected={draft.categories}
                                onChange={(categories) =>
                                    update("categories", categories)
                                }
                            />
                        </Field>

                        {/*
                         * At the foot of the form rather than in the header,
                         * which has room for one action and gives it to
                         * publishing. Neither of these is something to reach
                         * for mid-sentence.
                         */}
                        {status && (
                            <View className="flex-row flex-wrap gap-2 border-t border-ink/10 pt-5">
                                {isPublished && (
                                    <Button
                                        label={t("editor.archive")}
                                        variant="outline"
                                        size="sm"
                                        disabled={editor.isBusy}
                                        onPress={() => setConfirm("archive")}
                                    />
                                )}
                                <Button
                                    label={t("editor.delete")}
                                    variant="dangerOutline"
                                    size="sm"
                                    disabled={editor.isBusy}
                                    onPress={() => setConfirm("delete")}
                                />
                            </View>
                        )}
                    </ScrollView>
                ) : draft.body.trim() === "" ? (
                    <EmptyState title={t("editor.emptyPreview")} />
                ) : (
                    <ScrollView className="flex-1">
                        {draft.title.trim() !== "" && (
                            <Text
                                size="display"
                                className="px-4 pt-5 leading-9"
                            >
                                {draft.title}
                            </Text>
                        )}
                        {/*
                         * The reading screen's own renderer, so the preview
                         * cannot drift from what readers get. No `mentions`:
                         * the API has resolved nothing in text it has not
                         * stored, and linking every handle would promise links
                         * the published article may not have.
                         */}
                        <MarkdownBody body={draft.body} mentions={undefined} />
                    </ScrollView>
                )}

                {/*
                 * Docked above the keyboard rather than under the field. The
                 * body runs to screens of text, and a list drawn after it would
                 * sit wherever the text ends — usually nowhere near the line
                 * being written. The caret cannot be measured, so the one place
                 * guaranteed to be in view while typing is the keyboard's edge.
                 */}
                {tab === "write" && isBodyFocused && mention.isOpen && (
                    <View className="border-t border-ink/10 bg-ground px-3 py-2">
                        <MentionSuggestions
                            isSearching={mention.isSearching}
                            suggestions={mention.suggestions}
                            onSelect={(item) => {
                                const next = mention.select(item);
                                if (next !== null) update("body", next);
                            }}
                        />
                    </View>
                )}
            </KeyboardAvoidingView>

            <Modal visible={confirm !== null} onClose={() => setConfirm(null)}>
                <View className="gap-2">
                    <Text size="lead" className="font-semibold">
                        {t(
                            confirm === "delete"
                                ? "editor.deleteTitle"
                                : "editor.archiveTitle",
                        )}
                    </Text>
                    <Text size="small" tone="muted">
                        {t(
                            confirm === "delete"
                                ? "editor.deleteBody"
                                : "editor.archiveBody",
                        )}
                    </Text>
                </View>
                <View className="mt-6 flex-row justify-end gap-2">
                    <Button
                        label={t("common.cancel")}
                        variant="outline"
                        size="sm"
                        onPress={() => setConfirm(null)}
                    />
                    <Button
                        label={t(
                            confirm === "delete"
                                ? "editor.delete"
                                : "editor.archive",
                        )}
                        variant={confirm === "delete" ? "danger" : "primary"}
                        size="sm"
                        onPress={() =>
                            void (confirm === "delete"
                                ? handleDelete()
                                : handleArchive())
                        }
                    />
                </View>
            </Modal>

            <Modal
                visible={pendingLeave !== null}
                onClose={() => setPendingLeave(null)}
            >
                <View className="gap-2">
                    <Text size="lead" className="font-semibold">
                        {t("editor.leaveWarning")}
                    </Text>
                    <Text size="small" tone="muted">
                        {t("editor.leaveBody")}
                    </Text>
                </View>
                <View className="mt-6 flex-row flex-wrap justify-end gap-2">
                    <Button
                        label={t("editor.keepWriting")}
                        variant="outline"
                        size="sm"
                        onPress={() => setPendingLeave(null)}
                    />
                    <Button
                        label={t("editor.discard")}
                        variant="danger"
                        size="sm"
                        onPress={() => {
                            const go = pendingLeave;
                            setPendingLeave(null);
                            go?.();
                        }}
                    />
                </View>
            </Modal>
        </Screen>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <View className="gap-2 border-t border-ink/10 pt-5">
            <Text
                size="caption"
                tone="subtle"
                className="font-semibold uppercase tracking-wider"
            >
                {label}
            </Text>
            {children}
        </View>
    );
}
