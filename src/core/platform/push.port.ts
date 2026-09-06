/**
 * Notifications that reach a phone nobody is looking at.
 *
 * The API's side of this is settled (`docs/push-notifications.md` in the API
 * repo): register the token at *every* launch, not only the first, because the
 * platform can reissue one at any time and re-registering is also what keeps
 * the row from being swept as abandoned. Retire it on sign-out, or a
 * signed-out phone keeps receiving the previous account's notifications.
 *
 * The payload carries ids and a type and nothing else, so `onTapped` routes
 * from `data.type` plus whichever ids are present. Direct messages are never
 * pushed — their text is encrypted at rest, and a preview in a push payload
 * would route it through Google's servers and undo that.
 *
 * The adapter lands with the notifications feature. Android 13+ needs a
 * runtime permission, and *when* it is asked for decides whether most people
 * enable push or most refuse — so that call belongs to a screen, not to boot.
 */
export interface PushPort {
    requestPermission(): Promise<boolean>;
    getToken(): Promise<string | null>;

    /** Returns the unsubscribe function. */
    onTapped(listener: (data: Record<string, unknown>) => void): () => void;
}
