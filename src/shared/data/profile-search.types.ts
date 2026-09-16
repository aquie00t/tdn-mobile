/**
 * One account in a set of search results.
 *
 * Deliberately narrower than `Profile`: the endpoint sends the whole profile —
 * banner, socials, counts, both block flags — and a row this size draws four
 * fields of it. Typing only those four is what keeps this feature from
 * growing a second opinion about what a profile is; the profile feature owns
 * that, and nothing here needs it.
 *
 * `id`, not `userId`. The search endpoint sends `id`, and the two names have
 * already been mixed up once in this codebase — on the field a follow request
 * is built from.
 */
export interface ProfileSearchItem {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string;
}
