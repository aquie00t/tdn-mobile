import { Share } from "react-native";

export type ShareOutcome = "shared" | "dismissed" | "error";

/**
 * Hands a link to whatever the reader wants to send it with.
 *
 * **The URL goes in `message`, not in `url`.** `Share`'s `url` field is an iOS
 * one; Android drops it and sends the message alone, so a link passed the tidy
 * way arrives as a sentence with nothing to tap. Both are given here — Android
 * reads the message, iOS reads both — and the message carries the address.
 *
 * Dismissing the sheet is not a failure. The web's version says the same thing
 * about `AbortError`: it is somebody closing a dialog they opened, and an error
 * toast on every cancel would punish them for changing their mind.
 *
 * The web's clipboard fallback is not ported. It exists there because
 * `navigator.share` is missing on desktop browsers; `Share` is always present
 * on a phone.
 *
 * @param text - What to say about the thing being shared
 * @param url - The address
 * @returns What happened, for the caller to decide whether to say anything
 */
export async function shareLink(
    text: string,
    url: string,
): Promise<ShareOutcome> {
    try {
        const result = await Share.share({
            message: `${text}\n\n${url}`,
            url,
        });

        return result.action === Share.sharedAction ? "shared" : "dismissed";
    } catch {
        return "error";
    }
}
