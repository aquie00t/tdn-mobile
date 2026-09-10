/**
 * The parts of an `expo-image-picker` asset an upload needs.
 *
 * Declared here rather than imported, so this file — and its test — has no
 * native module in its graph. `expo-image-picker` cannot load off a device.
 */
export interface PickedAsset {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
}

/** What React Native's `FormData` accepts for a file. */
export interface FormFilePart {
    uri: string;
    name: string;
    type: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
};

const FALLBACK_MIME = "application/octet-stream";

function extensionOf(uri: string): string {
    const path = uri.split(/[?#]/)[0];
    const dot = path.lastIndexOf(".");
    return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

/**
 * Turns a picked asset into something `FormData` can carry.
 *
 * Both fields the picker is supposed to supply are optional, and on Android
 * `fileName` is frequently `null` — a file chosen through the photo picker
 * arrives as a content URI with no name attached. A part with no name is
 * rejected by the API's multipart parser before it reaches moderation, so both
 * are derived from the URI when they are missing.
 *
 * @param asset - What the picker returned
 * @param index - Its place in the selection, used only to name an unnamed file
 * @returns The part, with a name and a type
 */
export function assetToFormPart(
    asset: PickedAsset,
    index: number,
): FormFilePart {
    const extension = extensionOf(asset.uri);

    return {
        uri: asset.uri,
        name:
            asset.fileName ||
            `upload-${index}${extension ? `.${extension}` : ""}`,
        type: asset.mimeType || MIME_BY_EXTENSION[extension] || FALLBACK_MIME,
    };
}

/**
 * Builds the multipart body `POST /media` expects.
 *
 * The field name is `files` for every part — the endpoint takes up to four
 * under one name rather than `files[0]`, `files[1]`.
 *
 * The cast is the one place this shape is smuggled past the DOM types.
 * `FormData.append` is typed against a browser's `Blob`; React Native's
 * implementation takes `{ uri, name, type }` and reads the file itself. Doing
 * it here means no call site has to know that.
 *
 * @param assets - What the picker returned
 * @returns A body ready to send with `contentType: false`
 */
export function buildMediaForm(assets: PickedAsset[]): FormData {
    const form = new FormData();

    assets.forEach((asset, index) => {
        form.append("files", assetToFormPart(asset, index) as unknown as Blob);
    });

    return form;
}
