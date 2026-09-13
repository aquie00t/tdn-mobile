import { isOurFailure } from "./error-handler";
import { translate } from "../i18n/translate";

/**
 * Whether this is a development build.
 *
 * `__DEV__` is React Native's, set by Metro. It does not exist under Vitest,
 * so it is read through `typeof` rather than referenced bare — a bare read is
 * a `ReferenceError` in every test that reaches this file.
 */
export function isDevBuild(): boolean {
    return typeof __DEV__ !== "undefined" && __DEV__;
}

/**
 * Where a failure goes when the person using the app should not see it.
 *
 * **The reader is not shown our errors.** A like that did not land rolls back,
 * a post that did not send stays in its composer, a list that did not load
 * offers to try again — and none of them explains why, because the reason is
 * ours to fix and not theirs to read. What they do see, inline, is an answer
 * they have to act on: a wrong password, a username that is taken, a deleted
 * post, a file that was refused. `readerFacingMessage` draws that line.
 *
 * In a development build the failure is logged, and React Native's LogBox
 * raises it at the bottom of the screen — so the developer sees every one,
 * with the object attached. In a release build this does nothing. It is the
 * one place a crash reporter would be wired in.
 *
 * @param context - Where it happened, e.g. `"post.like"`
 * @param error - What was thrown, or a sentence when nothing was
 */
export function reportError(context: string, error: unknown): void {
    if (!isDevBuild()) return;

    // eslint-disable-next-line no-console
    console.warn(`[${context}]`, error);
}

/**
 * What a reader is shown for a read that failed.
 *
 * The server's answer as it is — "Post not found.", a rate limit — because
 * that is something to act on, and a retry button under "could not load"
 * would invite a tap that can never work. Our own failure becomes only "could
 * not load", with the retry beside it. A development build shows everything.
 *
 * @param message - What `getErrorMessage` produced
 */
export function readerFacingMessage(message: string): string {
    if (isDevBuild() || !isOurFailure(message)) return message;
    return translate("common.loadFailed");
}
