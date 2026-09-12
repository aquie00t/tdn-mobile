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
 */

/**
 * Three states, not a boolean, because the middle one is the whole design.
 *
 * `undetermined` is the only state in which the dialog can still be shown, and
 * Android gives it out once: a refusal takes `canAskAgain` away for good and
 * the dialog never appears again, whatever the app does. So asking is not a
 * thing to retry — it is a single chance to spend at the right moment, which
 * is why {@link PushPort.getPermission} exists beside `requestPermission` and
 * why boot reads it rather than asking.
 */
export type PushPermission = "granted" | "denied" | "undetermined";

export interface PushPort {
    /** Reads the current state. Never shows a dialog. */
    getPermission(): Promise<PushPermission>;

    /**
     * Shows the dialog, and resolves to whether notifications may now be
     * shown. Android 13+ answers `false` immediately when the state is
     * `denied`, so the caller has to have checked.
     */
    requestPermission(): Promise<boolean>;

    /** `null` when there is no token to be had — see the adapter for when. */
    getToken(): Promise<string | null>;

    /** Returns the unsubscribe function. */
    onTapped(listener: (data: Record<string, unknown>) => void): () => void;
}
