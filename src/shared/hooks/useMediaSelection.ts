import * as ImagePicker from "expo-image-picker";
import { useCallback, useRef, useState } from "react";

import { clearsSelection } from "../utils/media-errors";
import {
    MAX_MEDIA_FILES,
    MEDIA_ENDPOINTS,
    uploadMedia,
} from "../utils/media-upload";
import type { MediaEndpoint } from "../utils/media-upload";
import type { PickedAsset } from "../utils/asset-to-form";

/**
 * Choosing files, and what happens to the choice when something fails.
 *
 * Shared because a post, a comment and a message all ask exactly the same
 * question. It was written inside the post composer first and moved here the
 * moment the comment box needed it, rather than copied — the failure rules
 * below are the part worth not having twice.
 *
 * The endpoint is a parameter because the *channel* differs even though the
 * question does not: a message's attachments go to `/messages/media` and
 * nothing uploaded there can be attached to a post.
 *
 * @param max - How many files this composer offers
 * @param endpoint - Which upload channel the files belong to
 */
export function useMediaSelection(
    max: number = MAX_MEDIA_FILES,
    endpoint: MediaEndpoint = MEDIA_ENDPOINTS.post,
) {
    const [assets, setAssets] = useState<PickedAsset[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    /**
     * What the last successful upload of *this* selection returned.
     *
     * Uploading is not idempotent — the same bytes sent twice are two sets of
     * files with two sets of URLs — so a composer retrying a failed send must
     * not send them again. It would orphan the first upload, spend a second of
     * the five writes a minute, and, worst, change the body the caller minted
     * its idempotency key for: a retry under a fresh key is the double post
     * the key exists to prevent.
     *
     * Keyed by what was picked, so changing the selection misses the cache and
     * uploads again, which is what somebody who swapped a photo means.
     */
    const uploaded = useRef<{ selection: string; urls: string[] } | null>(null);

    const remainingSlots = max - assets.length;
    const selection = assets.map((asset) => asset.uri).join("\u0000");

    const add = useCallback(
        (picked: PickedAsset[]) => {
            setAssets((prev) => [...prev, ...picked].slice(0, max));
        },
        [max],
    );

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
        add(result.assets);
    }, [remainingSlots, add]);

    /** The thing a phone can do that a browser cannot. */
    const takePhoto = useCallback(async () => {
        if (remainingSlots <= 0) return;

        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;

        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });

        if (result.canceled) return;
        add(result.assets);
    }, [remainingSlots, add]);

    const removeAsset = useCallback((uri: string) => {
        setAssets((prev) => prev.filter((asset) => asset.uri !== uri));
    }, []);

    const clear = useCallback(() => {
        setAssets([]);
        uploaded.current = null;
    }, []);

    const upload = useCallback(async () => {
        if (assets.length === 0) return [];
        if (uploaded.current?.selection === selection)
            return uploaded.current.urls;

        setIsUploading(true);
        try {
            const urls = await uploadMedia(assets, endpoint);
            uploaded.current = { selection, urls };
            return urls;
        } finally {
            setIsUploading(false);
        }
        /*
         * `memo-dependencies` reads one of these as redundant, and none of
         * them is. `assets` is what gets sent; `selection` is what decides
         * whether it has been sent already, and is derived from `assets` but
         * not equal to it; `endpoint` is a parameter, so a caller that changed
         * channels would otherwise keep uploading to the old one through a
         * stale closure — and the two channels refuse each other's files.
         */
        // eslint-disable-next-line react/memo-dependencies
    }, [assets, endpoint, selection]);

    /**
     * What a failure does to the selection.
     *
     * A verdict makes it unusable: `/media` processes the files in order and
     * returns no URLs at all once one is rejected, so even the files that
     * uploaded before it have nothing to send — and nothing here knows which
     * file it was, so all of them go and the person picks again.
     *
     * Everything else keeps them. A 503 was retried once already and is worth
     * another by hand, and a failure from the create call that follows the
     * upload says nothing about the files at all.
     */
    const handleFailure = useCallback((err: unknown) => {
        if (!clearsSelection(err)) return;

        setAssets([]);
        uploaded.current = null;
    }, []);

    return {
        assets,
        pickFromLibrary,
        takePhoto,
        removeAsset,
        remainingSlots,
        isUploading,
        upload,
        clear,
        handleFailure,
        max,
    };
}
