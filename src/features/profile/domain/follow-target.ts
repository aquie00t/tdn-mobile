/**
 * Whether a follow request can be sent at all.
 *
 * An empty id is not dropped from a body the way `undefined` is: it reaches
 * the server as `{ targetId: "" }`, fails validation, and the optimistic
 * rollback undoes the flip with no toast. The button appears to work and then
 * silently un-presses itself, which is the least debuggable shape this can
 * take — so the caller refuses to send instead, and says so.
 *
 * `id` and `userId` are both read because the API answers with `id` on a
 * profile and `userId` on a row in a follow list. The web declared those the
 * other way round for a while and nothing caught it: a field the server never
 * sends still typechecks as a `string`, and the failure only shows at the far
 * end as a key `JSON.stringify` quietly dropped.
 *
 * @param account - Whatever carries the account's identity
 * @returns The id to follow, or `null` when there is none
 */
export function followTargetId(account: {
    id?: string;
    userId?: string;
}): string | null {
    const id = account.id ?? account.userId ?? "";
    return id.trim().length > 0 ? id : null;
}
