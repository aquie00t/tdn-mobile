import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

import { clearsSelection } from "../utils/media-errors";
import { MAX_MEDIA_FILES, uploadMedia } from "../utils/media-upload";
import type { PickedAsset } from "../utils/asset-to-form";

/**
 * Choosing files, and what happens to the choice when something fails.
 *
 * Shared because a post and a comment ask exactly the same question of the
 * same endpoint. It was written inside the post composer first and moved here
 * the moment the comment box needed it, rather than copied — the failure rules
 * below are the part worth not having twice.
 */
export function useMediaSelection(max: number = MAX_MEDIA_FILES) {
    const [assets, setAssets] = useState<PickedAsset[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const remainingSlots = max - assets.length;

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

    const clear = useCallback(() => setAssets([]), []);

    const upload = useCallback(async () => {
        if (assets.length === 0) return [];

        setIsUploading(true);
        try {
            return await uploadMedia(assets);
        } finally {
            setIsUploading(false);
        }
    }, [assets]);

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
        if (clearsSelection(err)) setAssets([]);
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
