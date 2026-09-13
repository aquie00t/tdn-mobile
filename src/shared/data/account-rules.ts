/**
 * The rules an account's credentials are held to, in one place, because two
 * features enforce them: signing up, and changing them later in Settings.
 *
 * They mirror the API's *register* schema. Its change-username and
 * change-password schemas carry no rules at all — both are a bare string — so
 * without these a username could be changed to one that could never have been
 * registered: a space in it, or two hundred characters of it. Holding the
 * change to the rules of the original is what keeps every username in the
 * same shape, whatever the server accepts.
 */
export const AUTH_LIMITS = {
    identifierMax: 100,
    usernameMin: 3,
    usernameMax: 30,
    passwordMin: 8,
    /** Exactly eight, digits only. */
    otpLength: 8,
} as const;

export const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;
export const OTP_PATTERN = /^[0-9]+$/;

/**
 * Something, an `@`, something, a dot, something — and no spaces.
 *
 * Deliberately loose. The API validates `format: "email"` and answers a miss
 * with its schema's wording ("must match format \"email\""), which is not a
 * sentence to show anybody; this catches the typing slip so that never
 * happens, and leaves the real verdict to the server and the inbox.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UsernameProblem = "tooShort" | "tooLong" | "invalidCharacters";

/**
 * What is wrong with a username, or `null` when nothing is.
 *
 * Expects the value already trimmed — what is checked is what will be sent.
 */
export function validateUsername(username: string): UsernameProblem | null {
    if (username.length < AUTH_LIMITS.usernameMin) return "tooShort";
    if (username.length > AUTH_LIMITS.usernameMax) return "tooLong";
    if (!USERNAME_PATTERN.test(username)) return "invalidCharacters";
    return null;
}

export type NewPasswordProblem = "mismatch" | "tooShort";

/**
 * What is wrong with a new password and its confirmation, or `null`.
 *
 * The mismatch is reported first, as the web does: two fields that disagree
 * are the likelier mistake, and fixing the length of one of them would not
 * make them agree.
 */
export function validateNewPassword(
    newPassword: string,
    confirmation: string,
): NewPasswordProblem | null {
    if (newPassword !== confirmation) return "mismatch";
    if (newPassword.length < AUTH_LIMITS.passwordMin) return "tooShort";
    return null;
}
