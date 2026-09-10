import * as ImagePicker from "expo-image-picker";
import { useCallback, useRef, useState } from "react";

import { buildMediaForm } from "@shared/utils/asset-to-form";
import {
    clearsSelection,
    withModerationRetry,
} from "@shared/utils/media-errors";
import { feedApi } from "../../data/feed.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { newIdempotencyKey } from "@core/api/idempotency";
import type { PickedAsset } from "@shared/utils/asset-to-form";
import type { Post } from "../../data/feed.types";
import { useToastStore } from "@shared/store/toast.store";

/** The API refuses a fifth file, so the picker never offers one. */
export const MAX_FILES = 4;

/** The API's own cap on a post body. Mirrored so its 400 is unreachable. */
export const POST_MAX_LENGTH = 300;

/**
 * Writing a post: what has been picked, what is being uploaded, and what
 * happens when either fails.
 *
 * Everything a person can create here is a `COMMUNITY` post, and that is not a
 * simplification. `TECH_NEWS` and `SYSTEM_UPDATE` are refused for anyone but a
 * bot account, which is also why the web's composer is hidden on those tabs
 * rather than offering a type nobody can use.
 */
export function usePostComposer(onPosted: (post: Post) => void) {
    const addToast = useToastStore((s) => s.addToast);

    const [content, setContent] = useState("");
    const [assets, setAssets] = useState<PickedAsset[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * One key for one attempt at *this* post, held across retries.
     *
     * The window it closes is the widest in the flow: the media has uploaded,
     * the create times out, and nobody can say whether the post exists. Under
     * the same key the API answers from the first attempt. Minting a fresh one
     * would both risk a second post and fail anyway — the `mediaUrls` are
     * attached to the first, and re-sending them is `MediaNotOwnedError`.
     */
    const idempotencyKey = useRef<string | null>(null);

    const trimmed = content.trim();
    const isTooLong = trimmed.length > POST_MAX_LENGTH;
    const canSubmit =
        (trimmed.length > 0 || assets.length > 0) &&
        !isTooLong &&
        !isSubmitting;

    const remainingSlots = MAX_FILES - assets.length;

    /**
     * Permission is asked for here rather than at boot, and that is a product
     * decision rather than an implementation detail: an app that asks on its
     * first screen, before anybody has tried to do anything, is an app most
     * people say no to. Asked at the moment somebody presses "add a photo",
     * the question answers itself.
     */
    const pickFromLibrary = useCallback(async () => {
        if (remainingSlots <= 0) return;

        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsMultipleSelection: true,
            selectionLimit: remainingSlots,
            quality: 0.8,
        });

        if (result.canceled) return;
        setAssets((prev) => [...prev, ...result.assets].slice(0, MAX_FILES));
    }, [remainingSlots]);

    /** The thing a phone can do that a browser cannot. */
    const takePhoto = useCallback(async () => {
        if (remainingSlots <= 0) return;

        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;

        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });

        if (result.canceled) return;
        setAssets((prev) => [...prev, ...result.assets].slice(0, MAX_FILES));
    }, [remainingSlots]);

    const removeAsset = useCallback((uri: string) => {
        setAssets((prev) => prev.filter((asset) => asset.uri !== uri));
    }, []);

    const submit = useCallback(async () => {
        if (!canSubmit) return;

        idempotencyKey.current ??= newIdempotencyKey();
        setIsSubmitting(true);

        try {
            let mediaUrls: string[] = [];

            if (assets.length > 0) {
                setIsUploading(true);
                // One 503 from the moderation provider is absorbed silently;
                // a second reaches the catch below, where the files are kept
                // and the person can try again themselves.
                const uploaded = await withModerationRetry(() =>
                    feedApi.uploadMedia(buildMediaForm(assets)),
                );
                mediaUrls = uploaded.mediaUrls;
                setIsUploading(false);
            }

            const post = await feedApi.createPost(
                trimmed,
                "COMMUNITY",
                mediaUrls,
                idempotencyKey.current,
            );

            idempotencyKey.current = null;
            setContent("");
            setAssets([]);
            onPosted(post);
        } catch (err) {
            /*
             * A verdict makes the selection unusable: `/media` processes the
             * files in order and returns no URLs at all once one is rejected,
             * so even the files that uploaded before it have nothing to send.
             * Nothing here knows which file it was, so all of them go and the
             * person picks again.
             *
             * Everything else keeps them. A 503 was retried once already and
             * is worth another by hand, and a failure from the create call
             * says nothing about the files at all.
             */
            if (clearsSelection(err)) setAssets([]);
            addToast({ type: "error", message: getErrorMessage(err) });
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    }, [canSubmit, assets, trimmed, onPosted, addToast]);

    return {
        content,
        setContent,
        assets,
        pickFromLibrary,
        takePhoto,
        removeAsset,
        remainingSlots,
        isUploading,
        isSubmitting,
        isTooLong,
        canSubmit,
        submit,
    };
}
